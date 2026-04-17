<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\Http;

$response = Http::withHeaders([
    'x-api-key' => config('anthropic.api_key'),
    'anthropic-version' => '2023-06-01',
    'content-type' => 'application/json',
])
    ->timeout(60)
    ->post('https://api.anthropic.com/v1/messages', [
        'model' => 'claude-sonnet-4-20250514',
        'max_tokens' => 100,
        'messages' => [
            ['role' => 'user', 'content' => 'Say "API works" in JSON: {"status":"..."}'],
        ],
    ]);

echo 'Status: '.$response->status()."\n";
echo 'Body: '.$response->body()."\n";
