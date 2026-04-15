<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    /**
     * GET /api/settings.
     */
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->telegram_connect_token === null || $user->telegram_connect_token === '') {
            $user->telegram_connect_token = 'sf_' . Str::lower(Str::random(16));
            $user->save();
            $user->refresh();
        }

        return response()->json([
            'data' => $this->settingsPayload($user),
        ]);
    }

    /**
     * PATCH /api/settings.
     */
    public function update(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $validated = $request->validate([
            'display_name' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'my_categories' => ['nullable', 'array'],
            'my_categories.*' => ['integer', 'exists:categories,id'],
            'email_digest_enabled' => ['nullable', 'boolean'],
            'email_digest_time' => ['nullable', 'string', 'regex:/^\d{2}:\d{2}$/'],
            'locale' => ['nullable', 'string', Rule::in(['en', 'vi'])],
        ]);

        $updateData = [];

        if (array_key_exists('display_name', $validated)) {
            $updateData['display_name'] = $validated['display_name'];
        }

        if (array_key_exists('email', $validated)) {
            $updateData['email'] = $validated['email'];
        }

        if (array_key_exists('my_categories', $validated)) {
            $updateData['my_categories'] = $validated['my_categories'];
        }

        if (array_key_exists('locale', $validated)) {
            $updateData['locale'] = $validated['locale'];
        }

        if (
            array_key_exists('email_digest_enabled', $validated)
            || array_key_exists('email_digest_time', $validated)
        ) {
            $deliveryPreferences = $user->delivery_preferences ?? [];
            if (!is_array($deliveryPreferences)) {
                $deliveryPreferences = [];
            }

            if (array_key_exists('email_digest_enabled', $validated)) {
                $deliveryPreferences['email'] = (bool) $validated['email_digest_enabled'];
            }

            if (array_key_exists('email_digest_time', $validated)) {
                $deliveryPreferences['email_time'] = $validated['email_digest_time'];
            }

            $updateData['delivery_preferences'] = $deliveryPreferences;
        }

        if ($updateData !== []) {
            $user->update($updateData);
            $user->refresh();
        }

        if ($user->telegram_connect_token === null || $user->telegram_connect_token === '') {
            $user->telegram_connect_token = 'sf_' . Str::lower(Str::random(16));
            $user->save();
            $user->refresh();
        }

        return response()->json([
            'data' => $this->settingsPayload($user),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function settingsPayload(User $user): array
    {
        $deliveryPreferences = $user->delivery_preferences ?? [];
        if (!is_array($deliveryPreferences)) {
            $deliveryPreferences = [];
        }

        return [
            'profile' => [
                'display_name' => $user->display_name,
                'x_username' => $user->x_username,
                'email' => $user->email,
                'avatar_url' => $user->avatar_url,
            ],
            'preferences' => [
                'my_categories' => $user->my_categories ?? [],
                'email_digest_enabled' => (bool) ($deliveryPreferences['email'] ?? false),
                'email_digest_time' => (string) ($deliveryPreferences['email_time'] ?? '08:00'),
                'locale' => $user->locale ?? 'en',
            ],
            'plan' => [
                'current' => $user->plan,
                'features' => $this->planFeatures((string) $user->plan),
            ],
            'telegram' => [
                'connected' => $user->telegram_chat_id !== null && $user->telegram_chat_id !== '',
                'chat_id' => $user->telegram_chat_id,
                'connect_token' => $user->telegram_connect_token,
            ],
        ];
    }

    /**
     * @return array<int, string>
     */
    private function planFeatures(string $plan): array
    {
        return match ($plan) {
            'free' => [
                '3_digests_per_week',
                'all_sources_view',
            ],
            'pro' => [
                'daily_digest',
                'my_kols_10',
                'draft_tweets',
                'email_digest',
                'archive_30d',
            ],
            'power' => [
                'daily_digest',
                'my_kols_50',
                'draft_tweets',
                'email_digest',
                'telegram_alerts',
                'archive_unlimited',
            ],
            default => [],
        };
    }
}
