<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use InvalidArgumentException;
use RuntimeException;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;
use Stripe\Subscription;

class StripeService
{
    private StripeClient $stripe;

    public function __construct()
    {
        $secret = config('services.stripe.secret');
        if (empty($secret)) {
            throw new RuntimeException('STRIPE_SECRET is not configured. Set it in .env file.');
        }

        $this->stripe = new StripeClient($secret);
    }

    /**
     * Đổi subscription hiện có (Pro) sang Power với proration; không tạo Checkout mới.
     *
     * @throws ApiErrorException
     */
    public function upgradeSubscriptionToPlan(User $user, string $targetPlan): void
    {
        if ($targetPlan !== 'power') {
            throw new InvalidArgumentException('Subscription upgrade only supports target plan: power.');
        }

        $currentPlan = (string) ($user->plan ?? 'free');
        if ($currentPlan !== 'pro') {
            throw new InvalidArgumentException('User must be on the Pro plan to upgrade an existing subscription.');
        }

        $subscriptionId = $user->stripe_subscription_id;
        if ($subscriptionId === null || $subscriptionId === '') {
            $subscriptionId = $this->findActiveSubscriptionIdForCustomer($user);
        }

        if ($subscriptionId === null || $subscriptionId === '') {
            throw new InvalidArgumentException('No active Stripe subscription found. Complete a Pro checkout first or contact support.');
        }

        $newPriceId = $this->resolvePriceId('power');

        $subscription = $this->stripe->subscriptions->retrieve($subscriptionId, []);
        $status = (string) ($subscription->status ?? '');
        if (! in_array($status, ['active', 'trialing'], true)) {
            throw new InvalidArgumentException(
                'Your subscription is not active. Current status: '.$status
            );
        }

        $items = $subscription->items->data ?? [];
        if ($items === [] || ! isset($items[0]->id)) {
            throw new InvalidArgumentException('Stripe subscription has no line items.');
        }

        $subscriptionItemId = (string) $items[0]->id;

        $existingPriceId = isset($items[0]->price->id) ? (string) $items[0]->price->id : null;
        if ($existingPriceId === $newPriceId) {
            return;
        }

        // 'always_invoice' tạo và charge proration invoice ngay lập tức thay vì pending items.
        // Quan trọng: khi cancel_at_period_end=true, pending items từ create_prorations có thể không bao giờ được xuất hóa đơn.
        $this->stripe->subscriptions->update($subscriptionId, [
            'items' => [
                [
                    'id' => $subscriptionItemId,
                    'price' => $newPriceId,
                ],
            ],
            'proration_behavior' => 'always_invoice',
        ]);
    }

    /**
     * Sau khi Stripe subscription đã đổi giá Pro→Power, cập nhật users.plan và subscription_ends_at (webhook cũng sync sau).
     *
     * @throws ApiErrorException
     */
    public function syncLocalUserPlanAfterProToPowerUpgrade(User $user): void
    {
        $user->refresh();

        $subscriptionId = $user->stripe_subscription_id;
        if ($subscriptionId === null || $subscriptionId === '') {
            $resolved = $this->resolveSubscriptionIdForUpgrade($user);
            $subscriptionId = $resolved !== null && $resolved !== '' ? $resolved : null;
        }

        if ($subscriptionId === null || $subscriptionId === '') {
            return;
        }

        $subscription = $this->stripe->subscriptions->retrieve((string) $subscriptionId, []);
        $user->plan = 'power';
        $user->stripe_subscription_id = (string) $subscription->id;

        // Stripe API mới không còn current_period_end ở top-level; lấy từ items[0] hoặc cancel_at.
        $ts = null;
        $items = $subscription->items->data ?? [];
        if (! empty($items[0]) && is_numeric($items[0]->current_period_end ?? null)) {
            $ts = (int) $items[0]->current_period_end;
        } elseif (is_numeric($subscription->current_period_end ?? null)) {
            $ts = (int) $subscription->current_period_end;
        } elseif (! empty($subscription->cancel_at_period_end) && is_numeric($subscription->cancel_at ?? null)) {
            $ts = (int) $subscription->cancel_at;
        }

        if ($ts !== null) {
            $user->subscription_ends_at = Carbon::createFromTimestamp($ts)->utc();
        }
        $user->save();
    }

    /**
     * @throws ApiErrorException
     */
    public function resolveSubscriptionIdForUpgrade(User $user): ?string
    {
        if ($user->stripe_subscription_id !== null && $user->stripe_subscription_id !== '') {
            return (string) $user->stripe_subscription_id;
        }

        return $this->findActiveSubscriptionIdForCustomer($user);
    }

    /**
     * @throws ApiErrorException
     */
    public function retrieveStripeSubscription(string $subscriptionId): Subscription
    {
        return $this->stripe->subscriptions->retrieve($subscriptionId, []);
    }

    /**
     * @throws ApiErrorException
     */
    private function findActiveSubscriptionIdForCustomer(User $user): ?string
    {
        $customerId = $user->stripe_customer_id;
        if ($customerId === null || $customerId === '') {
            return null;
        }

        $list = $this->stripe->subscriptions->all([
            'customer' => $customerId,
            'status' => 'active',
            'limit' => 10,
        ]);

        foreach ($list->data as $subscription) {
            if (isset($subscription->id)) {
                return (string) $subscription->id;
            }
        }

        return null;
    }

    /**
     * Chặn tạo Checkout subscription mới khi đã có subscription đang hiệu lực (tránh trùng charge).
     *
     * @throws InvalidArgumentException
     */
    public function assertMayCreateCheckoutSubscription(User $user): void
    {
        if ($user->stripe_subscription_id !== null && $user->stripe_subscription_id !== '') {
            throw new InvalidArgumentException(
                'You already have an active subscription. Use upgrade options or manage billing before starting a new checkout.'
            );
        }

        $customerId = $user->stripe_customer_id;
        if ($customerId !== null && $customerId !== '' && $this->customerHasBillableSubscription($customerId)) {
            throw new InvalidArgumentException(
                'A subscription is already active on your account. Please wait for sync or use upgrade; avoid opening multiple checkouts.'
            );
        }
    }

    /**
     * Pro → Power qua Checkout: cần subscription Pro hiện có trên Stripe.
     *
     * @throws InvalidArgumentException
     */
    public function assertMayCheckoutUpgradeProToPower(User $user): void
    {
        if ((string) ($user->plan ?? 'free') !== 'pro') {
            throw new InvalidArgumentException('You must be on the Pro plan to upgrade to Power via checkout.');
        }

        $this->assertHasResolvableStripeSubscription($user);
    }

    /**
     * Gia hạn cùng gói (Pro/Power) qua Checkout — thay subscription hiện tại.
     *
     * @throws InvalidArgumentException
     */
    public function assertMayRenewPaidPlanViaCheckout(User $user, string $plan): void
    {
        if (! in_array($plan, ['pro', 'power'], true)) {
            throw new InvalidArgumentException('Renewal checkout is only available for Pro or Power.');
        }

        if ((string) ($user->plan ?? 'free') !== $plan) {
            throw new InvalidArgumentException('Renewal is only for your current paid plan.');
        }

        $this->assertHasResolvableStripeSubscription($user);
    }

    /**
     * @throws InvalidArgumentException
     */
    private function assertHasResolvableStripeSubscription(User $user): void
    {
        $subscriptionId = $user->stripe_subscription_id;
        if ($subscriptionId === null || $subscriptionId === '') {
            $subscriptionId = $this->findActiveSubscriptionIdForCustomer($user);
        }

        if ($subscriptionId === null || $subscriptionId === '') {
            throw new InvalidArgumentException('No active Stripe subscription found. Complete a checkout first or contact support.');
        }
    }

    /**
     * @throws ApiErrorException
     */
    private function customerHasBillableSubscription(string $customerId): bool
    {
        foreach (['active', 'trialing', 'past_due'] as $status) {
            $list = $this->stripe->subscriptions->all([
                'customer' => $customerId,
                'status' => $status,
                'limit' => 20,
            ]);
            if (($list->data ?? []) !== []) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  bool  $upgradeFromProToPower  Pro → Power: thay subscription cũ.
     * @param  bool  $renewSamePaidPlan  Gia hạn cùng gói Pro hoặc Power (thay subscription cũ).
     *
     * @throws ApiErrorException
     */
    public function createCheckoutSession(
        User $user,
        string $plan,
        bool $upgradeFromProToPower = false,
        bool $renewSamePaidPlan = false,
    ): string {
        $priceId = $this->resolvePriceId($plan);

        $sessionMetadata = [
            'user_id' => (string) $user->id,
            'plan' => $plan,
        ];
        if ($upgradeFromProToPower) {
            $sessionMetadata['upgrade_from'] = 'pro';
        }
        if ($renewSamePaidPlan) {
            $sessionMetadata['checkout_action'] = 'renew';
        }
        $priorSub = is_string($user->stripe_subscription_id) ? $user->stripe_subscription_id : '';
        if ($priorSub !== '' && ($upgradeFromProToPower || $renewSamePaidPlan)) {
            $sessionMetadata['prior_subscription_id'] = $priorSub;
        }

        $params = [
            'mode' => 'subscription',
            'line_items' => [
                [
                    'price' => $priceId,
                    'quantity' => 1,
                ],
            ],
            'success_url' => config('services.stripe.checkout_success_url'),
            'cancel_url' => config('services.stripe.checkout_cancel_url'),
            'metadata' => $sessionMetadata,
            // cancel_at_period_end không được phép trong Checkout Session create (API trả parameter_unknown).
            // Áp dụng sau khi subscription tồn tại: StripeWebhookService::handleCheckoutSessionCompleted.
            'subscription_data' => [
                'metadata' => [
                    'user_id' => (string) $user->id,
                    'plan' => $plan,
                ],
            ],
        ];

        if (! empty($user->stripe_customer_id)) {
            $params['customer'] = $user->stripe_customer_id;
            $params['customer_update'] = [
                'name' => 'auto',
                'address' => 'auto',
            ];
        } else {
            $params['customer_email'] = $user->email;
        }

        $session = $this->stripe->checkout->sessions->create($params);

        $url = isset($session->url) ? (string) $session->url : '';
        if ($url === '') {
            throw new RuntimeException('Stripe Checkout Session was created without a redirect URL.');
        }

        return $url;
    }

    /**
     * Pro → Power: tạo Checkout Session mode=setup để user chọn/xác nhận thẻ thanh toán (hỗ trợ SCA/3DS).
     * Sau khi setup hoàn tất, webhook checkout.session.completed sẽ gọi subscriptions.update + proration.
     *
     * @throws ApiErrorException
     */
    public function createSetupCheckoutForUpgrade(User $user, string $upgradeTo): string
    {
        if ($upgradeTo !== 'power') {
            throw new InvalidArgumentException('Setup checkout upgrade only supports target plan: power.');
        }

        if ((string) ($user->plan ?? 'free') !== 'pro') {
            throw new InvalidArgumentException('User must be on the Pro plan to upgrade to Power.');
        }

        $this->assertHasResolvableStripeSubscription($user);

        $params = [
            'mode' => 'setup',
            'currency' => (string) config('services.stripe.currency', 'usd'),
            'metadata' => [
                'user_id' => (string) $user->id,
                'checkout_action' => 'setup_for_upgrade',
                'upgrade_to' => $upgradeTo,
            ],
            'success_url' => config('services.stripe.checkout_success_url'),
            'cancel_url' => config('services.stripe.checkout_cancel_url'),
        ];

        if (! empty($user->stripe_customer_id)) {
            $params['customer'] = $user->stripe_customer_id;
        } else {
            $params['customer_email'] = $user->email;
        }

        $session = $this->stripe->checkout->sessions->create($params);

        $url = isset($session->url) ? (string) $session->url : '';
        if ($url === '') {
            throw new RuntimeException('Stripe Setup Checkout Session was created without a redirect URL.');
        }

        return $url;
    }

    private function resolvePriceId(string $plan): string
    {
        $priceId = match ($plan) {
            'pro' => config('services.stripe.pro_price_id'),
            'power' => config('services.stripe.power_price_id'),
            default => throw new InvalidArgumentException("Invalid plan: {$plan}"),
        };

        if (empty($priceId)) {
            throw new RuntimeException("Stripe price ID is missing for plan: {$plan}");
        }

        return (string) $priceId;
    }
}
