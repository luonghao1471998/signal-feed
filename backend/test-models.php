<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\Http;

$models = [
    'claude-3-5-sonnet-20241022',
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-latest',
];

foreach ($models as $model) {
    echo "Testing: $model\n";

    $response = Http::withHeaders([
        'x-api-key' => config('anthropic.api_key'),
        'anthropic-version' => '2023-06-01',
        'content-type' => 'application/json',
    ])
        ->timeout(60)
        ->post('https://api.anthropic.com/v1/messages', [
            'model' => $model,
            'max_tokens' => 100,
            'messages' => [
                ['role' => 'user', 'content' => 'Hi'],
            ],
        ]);

    echo 'Status: '.$response->status()."\n";
    if ($response->successful()) {
        echo "✅ WORKS!\n\n";
        break;
    } else {
        echo '❌ '.$response->json()['error']['message']."\n\n";
    }
}
