<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
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
            $user = User::updateOrCreate(
                [
                    'x_user_id' => $xUserId,
                ],
                [
                    'x_username' => $nickname !== '' ? $nickname : ($existingUser?->x_username ?? 'user_'.$xUserId),
                    'email' => $resolvedEmail ?? $existingUser?->email,
                    'avatar_url' => $resolvedAvatarUrl ?? $existingUser?->avatar_url,
                    'x_access_token' => $twitterUser->token,
                    'x_refresh_token' => $twitterUser->refreshToken,
                    'x_token_expires_at' => $twitterUser->expiresIn
                        ? now()->utc()->addSeconds($twitterUser->expiresIn)
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
                        'x_user_id' => (string) $twitterUser->getId(),
                    ]),
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                    'tenant_id' => $user->tenant_id ?? 1,
                    'created_at' => now()->utc(),
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
        $email = $twitterUser->getEmail();
        if (is_string($email)) {
            $normalized = trim(strtolower($email));
            if ($normalized !== '' && filter_var($normalized, FILTER_VALIDATE_EMAIL)) {
                return $normalized;
            }
        }

        /** @var array<string, mixed> $raw */
        $raw = $twitterUser->getRaw();
        $rawEmail = $raw['email'] ?? $raw['data']['email'] ?? null;
        if (! is_string($rawEmail)) {
            return null;
        }

        $rawEmail = trim(strtolower($rawEmail));
        if ($rawEmail === '' || ! filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        return $rawEmail;
    }
}
