<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Tweet;

$tweets = Tweet::with('source.categories')
    ->where('is_signal', false)
    ->limit(3)
    ->get();

echo "=== PROCESSING 3 TWEETS ===\n";
echo "Tweet IDs: " . $tweets->pluck('id')->join(', ') . "\n\n";

$service = new App\Services\SignalGeneratorService();
$reflection = new \ReflectionClass($service);

$callMethod = $reflection->getMethod('callClaudeAPI');
$callMethod->setAccessible(true);

try {
    echo "Calling Claude API...\n";
    $signals = $callMethod->invoke($service, $tweets->all());
    
    echo "✅ Success! Signals: " . count($signals) . "\n\n";
    
    if (!empty($signals)) {
        foreach ($signals as $i => $signal) {
            echo "=== SIGNAL " . ($i+1) . " ===\n";
            echo "Title: " . $signal['title'] . "\n";
            echo "Impact: " . $signal['impact_score'] . "\n";
            echo "Categories: " . implode(',', $signal['category_ids']) . "\n";
            echo "Tags: " . implode(',', $signal['topic_tags']) . "\n";
            echo "Tweet IDs: " . implode(',', $signal['related_tweet_ids']) . "\n\n";
        }
    } else {
        echo "ℹ️  No signals (tweets may be noise)\n";
    }
    
    echo "\nCost: ~$0.01\n";
    
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
