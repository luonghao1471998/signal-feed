<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;

class TwitterAuthController extends Controller
{
    public function __construct(
        private AuthService $authService
    ) {}

    public function redirect(): RedirectResponse
    {
        try {
            return Socialite::driver('twitter-oauth-2')
                ->scopes(['users.read', 'tweet.read', 'offline.access'])
                ->redirect();
        } catch (\Throwable $e) {
            Log::error('Twitter OAuth redirect failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect('/')
                ->with('error', 'Unable to connect to Twitter. Please try again.');
        }
    }

    public function callback(Request $request): RedirectResponse
    {
        if ($request->has('error')) {
            $errorDescription = $request->get('error_description', 'Authentication cancelled');

            Log::info('Twitter OAuth denied', [
                'error' => $request->get('error'),
                'description' => $errorDescription,
            ]);

            return redirect('/')
                ->with('error', 'Twitter authentication was cancelled.');
        }

        try {
            $twitterUser = Socialite::driver('twitter-oauth-2')->user();
            $user = $this->authService->upsertUserFromTwitter($twitterUser);

            Auth::login($user);
            $request->session()->regenerate();

            Log::info('User logged in via Twitter OAuth', [
                'user_id' => $user->id,
                'x_user_id' => $user->x_user_id,
                'x_username' => $user->x_username,
            ]);

            return redirect('/')
                ->with('success', 'Successfully logged in!');
        } catch (InvalidStateException $e) {
            Log::warning('Twitter OAuth invalid state', [
                'error' => $e->getMessage(),
                'ip' => $request->ip(),
            ]);

            return redirect('/')
                ->with('error', 'Invalid authentication request. Please try again.');
        } catch (\Throwable $e) {
            Log::error('Twitter OAuth callback failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect('/')
                ->with('error', 'Authentication failed. Please try again.');
        }
    }

    public function logout(Request $request): RedirectResponse
    {
        $userId = Auth::id();

        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        Log::info('User logged out', ['user_id' => $userId]);

        return redirect('/')
            ->with('success', 'Successfully logged out.');
    }
}
