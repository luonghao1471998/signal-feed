<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$job = new \App\Jobs\PersonalPipelineJob(3);
$job->handle(
    app(\App\Services\TweetClusterService::class),
    app(\App\Services\SignalSummarizerService::class),
    app(\App\Services\SignalRankingService::class),
    app(\App\Services\DraftTweetService::class)
);

$signal = \App\Models\Signal::where('type', 1)->where('user_id', 3)->first();
echo "Result: " . ($signal ? "Signal created! ID={$signal->id}, cluster_id={$signal->cluster_id}" : "No signal created") . "\n";
