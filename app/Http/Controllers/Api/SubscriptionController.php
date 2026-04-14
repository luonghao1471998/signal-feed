<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MySourceSubscription;
use App\Models\Source;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SubscriptionController extends Controller
{
    /**
     * POST /api/sources/{id}/subscribe — Pro/Power: follow an active pool source (My KOLs).
     */
    public function subscribe(int $sourceId): JsonResponse
    {
        $user = Auth::user();

        if ($user->plan === 'free') {
            return response()->json([
                'message' => 'Subscription feature is only available for Pro and Power users. Please upgrade your plan.',
            ], 403);
        }

        $cap = match ($user->plan) {
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
                $upgradePlan = $user->plan === 'pro' ? 'Power' : null;
                $message = $upgradePlan !== null
                    ? "Subscription limit reached ({$cap} KOLs). Upgrade to {$upgradePlan} plan to follow more KOLs."
                    : "Subscription limit reached ({$cap} KOLs).";

                return response()->json([
                    'message' => $message,
                    'current_count' => $currentCount,
                    'limit' => $cap,
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
                    'message' => 'You are already subscribed to this source',
                ], 409);
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
                'data' => [
                    'source_id' => $source->id,
                    'handle' => $handle,
                    'display_name' => $source->display_name,
                    'subscribed_at' => $now->toIso8601String(),
                    'subscription_count' => $newCount,
                ],
            ], 201);
        });
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
