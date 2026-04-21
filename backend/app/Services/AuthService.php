<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Contracts\User as SocialiteUser;

class AuthService
{
    /**
     * Create or update user from X/Twitter OAuth 2 data.
     */
    public function upsertUserFromTwitter(SocialiteUser $twitterUser): User
    {
        return DB::transaction(function () use ($twitterUser) {
            $nickname = $twitterUser->getNickname() ?? $twitterUser->getName() ?? '';
            $xUserId = (string) $twitterUser->getId();
            $existingUser = User::query()
                ->where('x_user_id', $xUserId)
                ->first();
            $resolvedAvatarUrl = $this->resolveAvatarUrl($twitterUser);
            $resolvedEmail = $this->resolveEmail($twitterUser);
            $resolvedDisplayName = $this->resolveDisplayName($twitterUser);
            $user = User::updateOrCreate(
                [
                    'x_user_id' => $xUserId,
                ],
                [
                    'x_username' => $nickname !== '' ? $nickname : ($existingUser?->x_username ?? 'user_'.$xUserId),
                    'display_name' => $resolvedDisplayName ?? $existingUser?->display_name,
                    'email' => $resolvedEmail ?? $existingUser?->email,
                    'avatar_url' => $resolvedAvatarUrl ?? $existingUser?->avatar_url,
                    'x_access_token' => $twitterUser->token,
                    'x_refresh_token' => $twitterUser->refreshToken,
                    'x_token_expires_at' => $twitterUser->expiresIn
                        ? now()->addSeconds($twitterUser->expiresIn)
                        : null,
                ]
            );

            try {
                DB::table('audit_logs')->insert([
                    'event_type' => 'oauth_login',
                    'user_id' => $user->id,
                    'resource_type' => 'User',
                    'resource_id' => $user->id,
                    'changes' => json_encode([
                        'oauth_provider' => 'twitter',
                        'x_username' => $user->x_username,
                        'display_name' => $user->display_name,
                        'x_user_id' => (string) $twitterUser->getId(),
                    ]),
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                    'tenant_id' => $user->tenant_id ?? 1,
                    'created_at' => now(),
                ]);
            } catch (\Throwable $e) {
                Log::warning('audit_logs oauth_login insert failed (user vẫn được lưu)', [
                    'error' => $e->getMessage(),
                    'user_id' => $user->id,
                ]);
            }

            return $user;
        });
    }

    /**
     * Tên hiển thị trên hồ sơ X (field "Name") — Socialite: {@see SocialiteUser::getName()}.
     */
    private function resolveDisplayName(SocialiteUser $twitterUser): ?string
    {
        $name = trim((string) ($twitterUser->getName() ?? ''));
        if ($name === '') {
            /** @var array<string, mixed> $raw */
            $raw = $twitterUser->getRaw();
            $rawName = $raw['name'] ?? null;
            if (is_string($rawName)) {
                $name = trim($rawName);
            }
        }
        if ($name === '') {
            return null;
        }

        return mb_substr($name, 0, 100);
    }

    private function resolveAvatarUrl(SocialiteUser $twitterUser): ?string
    {
        $avatar = trim((string) ($twitterUser->getAvatar() ?? ''));
        if ($avatar !== '') {
            return $avatar;
        }

        /** @var array<string, mixed> $raw */
        $raw = $twitterUser->getRaw();
        $rawAvatar = $raw['profile_image_url'] ?? $raw['profile_image_url_https'] ?? null;
        if (! is_string($rawAvatar)) {
            return null;
        }
        $rawAvatar = trim($rawAvatar);

        return $rawAvatar !== '' ? $rawAvatar : null;
    }

    private function resolveEmail(SocialiteUser $twitterUser): ?string
    {
        $xUserId = (string) $twitterUser->getId();
        $email = $twitterUser->getEmail();
        if (is_string($email)) {
            $normalized = trim(strtolower($email));
            if ($normalized !== '' && filter_var($normalized, FILTER_VALIDATE_EMAIL)) {
                Log::info('OAuth email resolved from Socialite payload', [
                    'x_user_id' => $xUserId,
                    'email_hint' => $this->maskEmail($normalized),
                ]);

                return $normalized;
            }
        }

        /** @var array<string, mixed> $raw */
        $raw = $twitterUser->getRaw();
        $rawEmail = $raw['email'] ?? $raw['data']['email'] ?? null;
        if (! is_string($rawEmail)) {
            Log::info('OAuth email missing in Socialite raw payload, fallback to X users/me', [
                'x_user_id' => $xUserId,
                'raw_has_email_key' => array_key_exists('email', $raw),
                'raw_data_has_email_key' => is_array($raw['data'] ?? null) && array_key_exists('email', $raw['data']),
            ]);

            return $this->fetchEmailFromXApi($twitterUser->token, $xUserId);
        }

        $rawEmail = trim(strtolower($rawEmail));
        if ($rawEmail === '' || ! filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
            Log::info('OAuth raw email invalid, fallback to X users/me', [
                'x_user_id' => $xUserId,
                'raw_email_hint' => $this->maskEmail($rawEmail),
            ]);

            return $this->fetchEmailFromXApi($twitterUser->token, $xUserId);
        }

        Log::info('OAuth email resolved from Socialite raw payload', [
            'x_user_id' => $xUserId,
            'email_hint' => $this->maskEmail($rawEmail),
        ]);

        return $rawEmail;
    }

    private function fetchEmailFromXApi(?string $accessToken, string $xUserId): ?string
    {
        $token = is_string($accessToken) ? trim($accessToken) : '';
        if ($token === '') {
            Log::warning('X email lookup skipped: empty access token', [
                'x_user_id' => $xUserId,
            ]);

            return null;
        }

        try {
            $response = Http::timeout(15)
                ->withToken($token)
                ->acceptJson()
                ->get('https://api.x.com/2/users/me', [
                    'user.fields' => 'confirmed_email',
                ]);

            if (! $response->ok()) {
                Log::info('X email lookup returned non-success', [
                    'x_user_id' => $xUserId,
                    'status' => $response->status(),
                    'body' => mb_substr((string) $response->body(), 0, 500),
                ]);

                return null;
            }

            $payload = $response->json();
            $candidate = $payload['data']['confirmed_email'] ?? null;
            if (! is_string($candidate)) {
                Log::info('X email lookup succeeded but confirmed_email missing', [
                    'x_user_id' => $xUserId,
                    'payload_keys' => is_array($payload) ? array_keys($payload) : [],
                    'data_keys' => is_array($payload['data'] ?? null) ? array_keys($payload['data']) : [],
                ]);

                return null;
            }

            $normalized = trim(strtolower($candidate));
            if ($normalized === '' || ! filter_var($normalized, FILTER_VALIDATE_EMAIL)) {
                Log::info('X email lookup returned invalid confirmed_email', [
                    'x_user_id' => $xUserId,
                    'email_hint' => $this->maskEmail($normalized),
                ]);

                return null;
            }

            Log::info('X email lookup resolved confirmed_email', [
                'x_user_id' => $xUserId,
                'email_hint' => $this->maskEmail($normalized),
            ]);

            return $normalized;
        } catch (\Throwable $e) {
            Log::warning('X email lookup failed', [
                'x_user_id' => $xUserId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function maskEmail(?string $email): ?string
    {
        if (! is_string($email)) {
            return null;
        }

        $value = trim(strtolower($email));
        if ($value === '') {
            return null;
        }

        if (! str_contains($value, '@')) {
            return 'invalid-format';
        }

        [$local, $domain] = explode('@', $value, 2);
        if ($local === '' || $domain === '') {
            return 'invalid-format';
        }

        $head = mb_substr($local, 0, 1);

        return $head.'***@'.$domain;
    }
}
