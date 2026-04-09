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
        'classify' => [
            'name' => env('ANTHROPIC_MODEL_CLASSIFY', 'claude-sonnet-4-20250514'),
            'max_tokens' => (int) env('ANTHROPIC_MAX_TOKENS_CLASSIFY', 256),
            'temperature' => (float) env('ANTHROPIC_TEMPERATURE_CLASSIFY', 0.1),
        ],
        'cluster' => [
            'name' => env('ANTHROPIC_MODEL_CLUSTER', 'claude-sonnet-4-20250514'),
            'max_tokens' => (int) env('ANTHROPIC_MAX_TOKENS_CLUSTER', 4096),
            'temperature' => (float) env('ANTHROPIC_TEMPERATURE_CLUSTER', 0.2),
        ],
    ],

    'classify_prompt_path' => env('ANTHROPIC_CLASSIFY_PROMPT_PATH', 'docs/prompts/v1/classify.md'),

    'cluster_prompt_path' => env('ANTHROPIC_CLUSTER_PROMPT_PATH', 'docs/prompts/v1/cluster.md'),

    'batch_size' => (int) env('ANTHROPIC_BATCH_SIZE', 100),
    'max_retries' => (int) env('ANTHROPIC_MAX_RETRIES', 3),
    'timeout' => (int) env('ANTHROPIC_TIMEOUT', 60),
];
