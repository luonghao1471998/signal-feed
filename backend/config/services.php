<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY', env('RESEND_KEY')),
        'from_address' => env('RESEND_FROM_ADDRESS', 'onboarding@resend.dev'),
        'from_name' => env('RESEND_FROM_NAME', 'SignalFeed'),
        'webhook_secret' => env('RESEND_WEBHOOK_SECRET'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    | OAuth 2.0 X.com (Socialite) — driver `twitter-oauth-2` (TwitterOAuth2Provider).
    | Khóa config phải trùng tên driver. .env: TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, TWITTER_CALLBACK_URL.
    */
    'twitter-oauth-2' => [
        'client_id' => env('TWITTER_CLIENT_ID'),
        'client_secret' => env('TWITTER_CLIENT_SECRET'),
        'redirect' => env('TWITTER_CALLBACK_URL', env('TWITTER_REDIRECT_URI')),
    ],

    /*
    | twitterapi.io — crawl (Artisan tweets:crawl). Base: https://api.twitterapi.io (không /v1).
    | GET /twitter/user/last_tweets?userName=&count= — response: data.tweets[] (hoặc tweets[] legacy).
    */
    'twitterapi' => [
        'key' => env('TWITTERAPI_KEY', env('TWITTER_API_KEY')),
        'base_url' => rtrim((string) (env('TWITTERAPI_BASE_URL', env('TWITTER_API_BASE_URL')) ?: 'https://api.twitterapi.io'), '/'),
        'rate_limit_requests' => 420,
        'rate_limit_window' => 900,
        'timeout' => (int) env('TWITTERAPI_TIMEOUT', 30),
    ],

    'telegram' => [
        'bot_token' => env('TELEGRAM_BOT_TOKEN'),
        /** Secret token gửi kèm header `X-Telegram-Bot-Api-Secret-Token` khi setWebhook. */
        'webhook_secret' => env('TELEGRAM_WEBHOOK_SECRET'),
    ],

    'stripe' => [
        'key' => env('STRIPE_KEY', env('STRIPE_PUBLISHABLE_KEY')),
        'secret' => env('STRIPE_SECRET', env('STRIPE_SECRET_KEY')),
        'pro_price_id' => env('STRIPE_PRO_PRICE_ID'),
        'power_price_id' => env('STRIPE_POWER_PRICE_ID'),
        /** Checkout `mode=setup` (Pro→Power) yêu cầu currency (Stripe API). */
        'currency' => strtolower((string) env('STRIPE_CURRENCY', 'usd')),
        // Webhook: map Price ID → plan (SPEC-api constraint #13). Unknown price_id → free + log.
        'price_plan_map' => array_filter([
            (string) env('STRIPE_PRO_PRICE_ID') => 'pro',
            (string) env('STRIPE_POWER_PRICE_ID') => 'power',
        ], static fn (string $priceId): bool => $priceId !== '', ARRAY_FILTER_USE_KEY),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        'checkout_success_url' => env('STRIPE_CHECKOUT_SUCCESS_URL', env('APP_URL', 'http://localhost:8000').'/settings?billing=success'),
        'checkout_cancel_url' => env('STRIPE_CHECKOUT_CANCEL_URL', env('APP_URL', 'http://localhost:8000').'/settings?billing=cancelled'),
    ],

];
