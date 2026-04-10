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
            $user = User::updateOrCreate(
                [
                    'x_user_id' => (string) $twitterUser->getId(),
                ],
                [
                    'x_username' => $nickname !== '' ? $nickname : 'user_'.$twitterUser->getId(),
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
}
