<?php

return [

    'api_key' => env('ANTHROPIC_API_KEY'),
    'api_version' => '2023-06-01',
    'base_url' => env('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),

    'models' => [
        'signal_generation' => [
            'name' => env('ANTHROPIC_MODEL_SIGNAL', 'claude-sonnet-4-20250514'),
            'max_tokens' => (int) env('ANTHROPIC_MAX_TOKENS_SIGNAL', 2048),
            'temperature' => (float) env('ANTHROPIC_TEMPERATURE_SIGNAL', 0.3),
        ],
    ],

    'batch_size' => (int) env('ANTHROPIC_BATCH_SIZE', 100),
    'max_retries' => (int) env('ANTHROPIC_MAX_RETRIES', 3),
    'timeout' => (int) env('ANTHROPIC_TIMEOUT', 60),
];
