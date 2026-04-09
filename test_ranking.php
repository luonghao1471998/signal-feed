<?php

declare(strict_types=1);

use App\Models\Signal;
use App\Services\SignalRankingService;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$service = app(SignalRankingService::class);

echo "=== Testing Signal Ranking ===\n\n";

$signal = Signal::query()->first();

if ($signal === null) {
    echo "Không có signal trong DB.\n";
    exit(1);
}

echo "Signal ID: {$signal->id}\n";
echo "Title: {$signal->title}\n";
echo "Source Count: {$signal->source_count}\n";
echo "Created At: {$signal->created_at}\n";
echo 'Hours Old: '.$signal->created_at->diffInHours(now())."h\n\n";

$rankScore = $service->calculateRankScore($signal);

echo "Calculated Rank Score: {$rankScore}\n";
echo 'Updated in DB: '.$signal->fresh()->rank_score."\n\n";

echo "=== Ranking All Signals ===\n\n";
$service->rankAllSignals(Signal::all());

$rankedSignals = Signal::query()->orderByDesc('rank_score')->get();

echo "Ranked Signals (highest to lowest):\n";
foreach ($rankedSignals as $idx => $sig) {
    echo ($idx + 1).". [{$sig->rank_score}] {$sig->title} ({$sig->source_count} sources)\n";
}
