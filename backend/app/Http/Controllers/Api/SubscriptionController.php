<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MySourceSubscription;
use App\Models\Source;
use App\Models\User;
use App\Services\StripeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use InvalidArgumentException;
use RuntimeException;
use Stripe\Exception\ApiErrorException;

class SubscriptionController extends Controller
{
    public function __construct(
        private readonly StripeService $stripeService
    ) {}

    /**
     * POST /api/sources/{id}/subscribe — follow an active pool source (My KOLs).
     */
    public function subscribe(Request $request, int $sourceId): JsonResponse
    {
        $user = $request->user() ?? Auth::user();

        $cap = match ($user->plan) {
            'free' => 5,
            'pro' => 10,
            'power' => 50,
            default => 0,
        };

        return DB::transaction(function () use ($user, $sourceId, $cap): JsonResponse {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            $currentCount = MySourceSubscription::query()
                ->where('user_id', $user->id)
                ->count();

            if ($currentCount >= $cap) {
                $upgradePlan = match ($user->plan) {
                    'free' => 'Pro',
                    'pro' => 'Power',
                    default => null,
                };
                $message = "Subscription limit reached ({$cap} KOLs).";
                if ($upgradePlan !== null) {
                    $message = "Subscription limit reached ({$cap} KOLs). Upgrade to {$upgradePlan} plan to follow more KOLs.";
                }

                return response()->json([
                    'error' => 'Subscription limit reached',
                    'message' => $message,
                    'current' => $currentCount,
                    'current_count' => $currentCount,
                    'limit' => $cap,
                    'upgrade_required' => in_array($user->plan, ['free', 'pro'], true),
                    'upgrade_plan' => $user->plan === 'free' ? 'pro' : ($user->plan === 'pro' ? 'power' : null),
                ], 400);
            }

            $source = Source::query()->find($sourceId);

            if (! $source) {
                return response()->json([
                    'message' => 'Source not found',
                ], 404);
            }

            if ($source->status !== 'active') {
                return response()->json([
                    'message' => "Cannot subscribe to source with status: {$source->status}. Only active sources can be followed.",
                    'source_status' => $source->status,
                ], 400);
            }

            $exists = MySourceSubscription::query()
                ->where('user_id', $user->id)
                ->where('source_id', $sourceId)
                ->exists();

            if ($exists) {
                return response()->json([
                    'message' => 'Already subscribed',
                    'current_count' => $currentCount,
                    'limit' => $cap,
                ], 200);
            }

            $tenantId = (int) ($user->tenant_id ?? 1);
            $now = now();

            DB::table('my_source_subscriptions')->insert([
                'user_id' => $user->id,
                'source_id' => $sourceId,
                'tenant_id' => $tenantId,
                'created_at' => $now,
            ]);

            $newCount = $currentCount + 1;
            $handle = $source->x_handle;
            if ($handle !== '' && ! str_starts_with($handle, '@')) {
                $handle = '@'.$handle;
            }

            return response()->json([
                'message' => 'Subscribed successfully',
                'data' => [
                    'source_id' => $source->id,
                    'handle' => $handle,
                    'display_name' => $source->display_name,
                    'subscribed_at' => $now->toIso8601String(),
                    'subscription_count' => $newCount,
                ],
                'current_count' => $newCount,
                'limit' => $cap,
                'upgrade_required' => $user->plan === 'free' && $newCount >= $cap,
            ], 201);
        });
    }

    /**
     * POST /api/sources/bulk-subscribe — subscribe multiple sources with plan cap.
     */
    public function bulkSubscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_ids' => 'required|array|max:50',
            'source_ids.*' => 'integer|exists:sources,id',
        ]);

        $user = $request->user() ?? Auth::user();
        $sourceIds = array_values(array_unique($validated['source_ids']));

        $cap = match ($user->plan) {
            'free' => 5,
            'pro' => 10,
            'power' => 50,
            default => 0,
        };

        return DB::transaction(function () use ($user, $sourceIds, $cap): JsonResponse {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            $currentCount = (int) MySourceSubscription::query()
                ->where('user_id', $user->id)
                ->count();

            $remaining = $cap - $currentCount;
            if ($remaining <= 0) {
                return response()->json([
                    'error' => 'Subscription limit reached',
                    'message' => 'You have already reached your subscription limit',
                    'limit' => $cap,
                    'current' => $currentCount,
                    'upgrade_required' => in_array($user->plan, ['free', 'pro'], true),
                    'upgrade_plan' => $user->plan === 'free' ? 'pro' : ($user->plan === 'pro' ? 'power' : null),
                ], 400);
            }

            $allowedSourceIds = array_slice($sourceIds, 0, $remaining);
            if ($allowedSourceIds === []) {
                return response()->json([
                    'message' => 'No sources provided',
                    'subscribed_count' => 0,
                    'total_count' => $currentCount,
                    'limit' => $cap,
                    'hit_limit' => $currentCount >= $cap,
                    'upgrade_required' => false,
                ], 200);
            }

            $existingIds = MySourceSubscription::query()
                ->where('user_id', $user->id)
                ->whereIn('source_id', $allowedSourceIds)
                ->pluck('source_id')
                ->map(static fn ($id): int => (int) $id)
                ->all();

            $newSourceIds = array_values(array_diff($allowedSourceIds, $existingIds));
            if ($newSourceIds === []) {
                return response()->json([
                    'message' => 'Already subscribed to all requested sources',
                    'subscribed_count' => 0,
                    'total_count' => $currentCount,
                    'limit' => $cap,
                    'hit_limit' => $currentCount >= $cap,
                    'upgrade_required' => false,
                ], 200);
            }

            $validSourceIds = Source::query()
                ->whereIn('id', $newSourceIds)
                ->where('status', 'active')
                ->pluck('id')
                ->map(static fn ($id): int => (int) $id)
                ->all();

            $tenantId = (int) ($user->tenant_id ?? 1);
            $now = now();
            $rows = [];
            foreach ($validSourceIds as $sourceId) {
                $rows[] = [
                    'user_id' => $user->id,
                    'source_id' => $sourceId,
                    'tenant_id' => $tenantId,
                    'created_at' => $now,
                ];
            }

            if ($rows !== []) {
                DB::table('my_source_subscriptions')->insert($rows);
            }

            $subscribedCount = count($validSourceIds);
            $totalCount = $currentCount + $subscribedCount;
            $hitLimit = $totalCount >= $cap;

            return response()->json([
                'message' => 'Subscribed successfully',
                'subscribed_count' => $subscribedCount,
                'total_count' => $totalCount,
                'limit' => $cap,
                'hit_limit' => $hitLimit,
                'upgrade_required' => $hitLimit && $user->plan === 'free',
            ], 201);
        });
    }

    /**
     * POST /api/subscriptions/upgrade — Pro → Power: subscription.update + proration (cùng endpoint với luồng billing/checkout).
     */
    public function upgradeSubscription(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plan' => ['required', 'string', 'in:power'],
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => (string) $validator->errors()->first('plan'),
                ],
            ], 400);
        }

        $user = $request->user();
        if ($user === null) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $currentPlan = (string) ($user->plan ?? 'free');
        if ($currentPlan !== 'pro') {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_UPGRADE_PATH',
                    'message' => 'Only Pro accounts can use this endpoint to upgrade to Power.',
                    'current_plan' => $currentPlan,
                ],
            ], 400);
        }

        $lock = Cache::lock('billing:upgrade-power:'.$user->id, 25);
        if (! $lock->get()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CONFLICT',
                    'message' => 'An upgrade is already in progress. Please wait a few seconds.',
                ],
            ], 409);
        }

        try {
            $this->stripeService->assertMayCheckoutUpgradeProToPower($user->fresh());
            $this->stripeService->upgradeSubscriptionToPlan($user->fresh(), 'power');
            $this->stripeService->syncLocalUserPlanAfterProToPowerUpgrade($request->user()->fresh());

            $message = 'Your plan has been upgraded to Power. Prorated charges or credits appear on your Stripe invoice.';

            return response()->json([
                'success' => true,
                'message' => $message,
                'plan' => 'power',
                'data' => [
                    'upgraded' => true,
                    'plan' => 'power',
                    'message' => $message,
                ],
            ]);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                ],
            ], 400);
        } catch (ApiErrorException $e) {
            Log::error('Stripe Pro→Power upgrade failed', [
                'user_id' => $user->id,
                'message' => $e->getMessage(),
                'stripe_code' => $e->getStripeCode(),
            ]);

            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'STRIPE_ERROR',
                    'message' => 'Payment service could not apply the upgrade. Please try again.',
                ],
            ], 502);
        } catch (RuntimeException $e) {
            Log::error('Stripe configuration error (Pro→Power)', [
                'user_id' => $user->id,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CONFIG_ERROR',
                    'message' => 'Billing service is not configured correctly.',
                ],
            ], 500);
        } catch (\Throwable $e) {
            Log::error('Unexpected Pro→Power upgrade error', [
                'user_id' => $user->id,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'Unexpected billing error. Please try again.',
                ],
            ], 500);
        } finally {
            $lock->release();
        }
    }

    /**
     * DELETE /api/sources/{id}/subscribe — remove source from My KOLs.
     */
    public function unsubscribe(int $sourceId): Response
    {
        $user = Auth::user();

        Source::query()->findOrFail($sourceId);

        MySourceSubscription::query()
            ->where('user_id', $user->id)
            ->where('source_id', $sourceId)
            ->delete();

        return response()->noContent();
    }
}
