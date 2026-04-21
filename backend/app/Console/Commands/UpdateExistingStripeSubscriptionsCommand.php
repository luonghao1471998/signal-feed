<?php

namespace App\Console\Commands;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

class UpdateExistingStripeSubscriptionsCommand extends Command
{
    protected $signature = 'subscriptions:update-existing';

    protected $description = 'Set cancel_at_period_end on Stripe subscriptions and sync users.subscription_ends_at (one-time migration)';

    public function handle(): int
    {
        $secret = config('services.stripe.secret');
        if ($secret === null || $secret === '') {
            $this->error('STRIPE_SECRET is not configured.');

            return self::FAILURE;
        }

        $stripe = new StripeClient($secret);

        $users = User::query()
            ->whereNotNull('stripe_subscription_id')
            ->where('stripe_subscription_id', '!=', '')
            ->orderBy('id')
            ->get();

        $stripeUpdated = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($users as $user) {
            $subId = (string) $user->stripe_subscription_id;
            try {
                $subscription = $stripe->subscriptions->retrieve($subId, []);
            } catch (ApiErrorException $e) {
                $this->error("User {$user->id}: retrieve failed — {$e->getMessage()}");
                $failed++;

                continue;
            }

            if (! in_array((string) ($subscription->status ?? ''), ['active', 'trialing', 'past_due'], true)) {
                $this->warn('User '.$user->id.': subscription '.$subId.' status '.(string) ($subscription->status ?? '').' — skipped');
                $skipped++;

                continue;
            }

            try {
                if (! ($subscription->cancel_at_period_end ?? false)) {
                    $subscription = $stripe->subscriptions->update($subId, [
                        'cancel_at_period_end' => true,
                    ]);
                    $this->info("User {$user->id}: set cancel_at_period_end=true for {$subId}");
                    $stripeUpdated++;
                }
            } catch (ApiErrorException $e) {
                $this->error("User {$user->id}: update failed — {$e->getMessage()}");
                $failed++;

                continue;
            }

            if (isset($subscription->current_period_end) && is_numeric($subscription->current_period_end)) {
                $user->subscription_ends_at = Carbon::createFromTimestamp((int) $subscription->current_period_end);
                $user->save();
            }
        }

        $this->info("Done. Stripe cancel_at_period_end set: {$stripeUpdated}, skipped (inactive status): {$skipped}, failed: {$failed}.");

        return self::SUCCESS;
    }
}
