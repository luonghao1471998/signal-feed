<?php

use App\Jobs\PersonalPipelineJob;
use App\Models\Signal;
use App\Services\DraftTweetService;
use App\Services\SignalRankingService;
use App\Services\SignalSummarizerService;
use App\Services\TweetClusterService;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$job = new PersonalPipelineJob(3);
$job->handle(
    app(TweetClusterService::class),
    app(SignalSummarizerService::class),
    app(SignalRankingService::class),
    app(DraftTweetService::class)
);

$signal = Signal::where('type', 1)->where('user_id', 3)->first();
echo 'Result: '.($signal ? "Signal created! ID={$signal->id}, cluster_id={$signal->cluster_id}" : 'No signal created')."\n";
