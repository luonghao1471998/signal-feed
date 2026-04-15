<?php

use App\Jobs\PipelineCrawlJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('pipeline:run {--limit=10 : Max tweets per source}', function () {
    $limit = max(1, min(100, (int) $this->option('limit')));
    $mock = config('app.mock_llm') ? 'FakeLLMClient' : 'Anthropic LLMClient';
    $this->info("Running pipeline (classifier: {$mock}, limit={$limit})…");
    dispatch_sync(new PipelineCrawlJob($limit));
    $this->info('Done.');
})->purpose('Run crawl + classify once (honours MOCK_LLM / .env)');

// Pipeline: crawl + classify — 4×/ngày VN (dispatch_sync: không phụ thuộc queue worker khi QUEUE_CONNECTION=redis)
Schedule::call(function () {
    $limit = (int) config('pipeline.tweets_per_source', 10);
    dispatch_sync(new PipelineCrawlJob($limit));
})
    ->name('pipeline:crawl-classify')
    ->cron('0 1,7,13,19 * * *')
    ->timezone('Asia/Ho_Chi_Minh')
    ->withoutOverlapping(120)
    ->before(function () {
        Log::channel('scheduler')->info('Pipeline (crawl + classify) starting', [
            'scheduled_time' => now()->toDateTimeString(),
            'timezone' => 'Asia/Ho_Chi_Minh',
        ]);
    })
    ->onSuccess(function () {
        Log::channel('scheduler')->info('Pipeline (crawl + classify) completed successfully', [
            'completed_at' => now()->toDateTimeString(),
            'duration' => 'See crawler.log for details',
        ]);
    })
    ->onFailure(function () {
        Log::channel('scheduler')->error('Pipeline (crawl + classify) scheduled run failed', [
            'failed_at' => now()->toDateTimeString(),
            'check' => 'See crawler-errors.log for details',
        ]);

        Log::channel('crawler-errors')->error('Scheduler triggered pipeline failure', [
            'timestamp' => now()->toDateTimeString(),
        ]);
    });

Schedule::command('sources:backfill-avatars --only-missing --limit=10 --sleep=2')
    ->name('sources:avatar-backfill')
    ->dailyAt('12:00')
    ->timezone('Asia/Ho_Chi_Minh')
    ->withoutOverlapping(120)
    ->before(function () {
        Log::channel('scheduler')->info('Avatar backfill starting', [
            'scheduled_time' => now()->toDateTimeString(),
            'timezone' => 'Asia/Ho_Chi_Minh',
        ]);
    })
    ->onSuccess(function () {
        Log::channel('scheduler')->info('Avatar backfill completed successfully', [
            'completed_at' => now()->toDateTimeString(),
        ]);
    })
    ->onFailure(function () {
        Log::channel('scheduler')->error('Avatar backfill scheduled run failed', [
            'failed_at' => now()->toDateTimeString(),
            'check' => 'See crawler-errors.log for details',
        ]);
    });
