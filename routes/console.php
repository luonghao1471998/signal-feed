<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Tweet Crawler — 4 lần/ngày (VN: 01:00, 07:00, 13:00, 19:00 Asia/Ho_Chi_Minh)
Schedule::command('tweets:crawl')
    ->cron('0 1,7,13,19 * * *')
    ->timezone('Asia/Ho_Chi_Minh')
    ->withoutOverlapping(120)
    ->runInBackground()
    ->before(function () {
        Log::channel('scheduler')->info('Tweet crawler starting', [
            'scheduled_time' => now()->toDateTimeString(),
            'timezone' => 'Asia/Ho_Chi_Minh',
        ]);
    })
    ->onSuccess(function () {
        Log::channel('scheduler')->info('Tweet crawler completed successfully', [
            'completed_at' => now()->toDateTimeString(),
            'duration' => 'See crawler.log for details',
        ]);
    })
    ->onFailure(function () {
        Log::channel('scheduler')->error('Tweet crawler scheduled run failed', [
            'failed_at' => now()->toDateTimeString(),
            'command' => 'tweets:crawl',
            'check' => 'See crawler-errors.log for details',
        ]);

        Log::channel('crawler-errors')->error('Scheduler triggered crawler failure', [
            'timestamp' => now()->toDateTimeString(),
        ]);
    });
