<?php

namespace App\Services;

use App\Models\User;
use InvalidArgumentException;
use RuntimeException;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

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
     * @throws ApiErrorException
     */
    public function createCheckoutSession(User $user, string $plan): string
    {
        $priceId = $this->resolvePriceId($plan);

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
            'metadata' => [
                'user_id' => (string) $user->id,
            ],
        ];

        if (! empty($user->stripe_customer_id)) {
            $params['customer'] = $user->stripe_customer_id;
        } else {
            $params['customer_email'] = $user->email;
        }

        $session = $this->stripe->checkout->sessions->create($params);

        return (string) $session->url;
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
