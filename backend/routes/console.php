<?php

use App\Jobs\PersonalPipelineJob;
use App\Jobs\PipelineCrawlJob;
use App\Jobs\SendDigestEmailJob;
use App\Jobs\SendTelegramDigestJob;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

//php artisan pipeline:run --limit=10 --skip-crawl --source=karpathy --source=sama
Artisan::command(
    'pipeline:run
    {--limit=5    : Max tweets per source (1–100)}
    {--skip-crawl : Bỏ qua bước crawl Twitter — chỉ chạy AI classify/cluster/… trên data DB hiện có}
    {--source=*   : Giới hạn crawl cho handle cụ thể, có thể truyền nhiều lần: --source=karpathy --source=sama}',
    function () {
        $limit      = max(1, min(100, (int) $this->option('limit')));
        $skipCrawl  = (bool) $this->option('skip-crawl');
        /** @var list<string> $sources */
        $sources    = (array) $this->option('source');
        $mock       = config('app.mock_llm') ? 'FakeLLMClient' : 'Anthropic LLMClient';

        $crawlNote  = $skipCrawl ? ' [CRAWL SKIPPED — AI only]' : '';
        $srcNote    = $sources !== [] ? ' sources=['.implode(',', $sources).']' : ' sources=all';
        $this->info("Running pipeline (classifier: {$mock}, limit={$limit}{$srcNote}){$crawlNote}…");

        dispatch_sync(new PipelineCrawlJob($limit, $skipCrawl, $sources));
        $this->info('Done.');
    }
)->purpose('Full pipeline (crawl + AI) — dùng --skip-crawl để bỏ crawl, --source=handle để giới hạn source');

// Shortcut: chỉ chạy phase AI (classify → cluster → summarize → rank → draft) trên data hiện có.
// Không tốn credit Twitter API. Hữu ích khi test AI pipeline hoặc sau khi đã crawl riêng.
Artisan::command(
    'pipeline:process
    {--lookback=0 : Giới hạn tweets theo số giờ gần đây (0 = toàn bộ chưa classify)}',
    function () {
        $lookback = max(0, (int) $this->option('lookback'));
        $mock     = config('app.mock_llm') ? 'FakeLLMClient' : 'Anthropic LLMClient';

        $this->info("Running AI pipeline only (classifier: {$mock}, lookback={$lookback}h)…");

        // Ghi đè lookback trong config nếu được truyền qua option
        if ($lookback === 0) {
            config(['signalfeed.classify_lookback_hours' => 0]);
            config(['signalfeed.cluster_lookback_hours'  => 0]);
        } else {
            config(['signalfeed.classify_lookback_hours' => $lookback]);
            config(['signalfeed.cluster_lookback_hours'  => $lookback]);
        }

        dispatch_sync(new PipelineCrawlJob(
            tweetsPerSource: 0,
            skipCrawl: true,
            sourceHandles: [],
        ));
        $this->info('Done.');
    }
)->purpose('AI-only pipeline (no crawl) — classify + cluster + summarize + rank + draft trên data DB hiện có');

// Pipeline: crawl + classify — 4×/ngày VN (dispatch_sync: không phụ thuộc queue worker khi QUEUE_CONNECTION=redis)
// Tiến trình chạy pipeline signal chung crawl + classify 4×/ngày VN (dispatch_sync: không phụ thuộc queue worker khi QUEUE_CONNECTION=redis)
// Schedule::call(function () {
//     $limit = (int) config('pipeline.tweets_per_source', 10);
//     dispatch_sync(new PipelineCrawlJob($limit));
// })
//     ->name('pipeline:crawl-classify')
//     ->cron('0 1,7,13,19 * * *')
//     ->timezone('Asia/Ho_Chi_Minh')
//     ->withoutOverlapping(120)
//     ->before(function () {
//         Log::channel('scheduler')->info('Pipeline (crawl + classify) starting', [
//             'scheduled_time' => now()->toDateTimeString(),
//             'timezone' => 'Asia/Ho_Chi_Minh',
//         ]);
//     })
//     ->onSuccess(function () {
//         Log::channel('scheduler')->info('Pipeline (crawl + classify) completed successfully', [
//             'completed_at' => now()->toDateTimeString(),
//             'duration' => 'See crawler.log for details',
//         ]);
//     })
//     ->onFailure(function () {
//         Log::channel('scheduler')->error('Pipeline (crawl + classify) scheduled run failed', [
//             'failed_at' => now()->toDateTimeString(),
//             'check' => 'See crawler-errors.log for details',
//         ]);

//         Log::channel('crawler-errors')->error('Scheduler triggered pipeline failure', [
//             'timestamp' => now()->toDateTimeString(),
//         ]);
//     });

// Tiến trình chạy pipeline riêng cho Pro/Power users có subscription (giờ Việt Nam)
// Schedule::call(function () {
//     // Query users cần chạy pipeline riêng
//     $users = User::query()
//         ->whereIn('plan', ['pro', 'power'])
//         ->whereHas('sourceSubscriptions')
//         ->get();

//     // Log số lượng users cần chạy pipeline riêng vào crawler channel
//     Log::channel('crawler')->info(
//         'PersonalPipeline fan-out started',
//         [
//             'total_users' => $users->count(),
//             'timestamp' => now()->toIso8601String(),
//         ]
//     );

//     // Dispatch 1 job per user cần chạy pipeline riêng
//     $users->each(function (User $user): void {
//         PersonalPipelineJob::dispatch($user->id);
//     });

//     Log::channel('crawler')->info(
//         'PersonalPipeline fan-out completed',
//         ['dispatched_jobs' => $users->count()]
//     );
// })
//     ->cron(env('PERSONAL_PIPELINE_CRON', '30 1,7,13,19 * * *'))
//     ->name('personal-pipeline-fanout')
//     ->description('Fan-out PersonalPipelineJob for Pro/Power users with subscriptions')
//     ->timezone('Asia/Ho_Chi_Minh')
//     ->withoutOverlapping(60)
//     ->onOneServer();

// Fan-out gửi digest email hằng ngày 08:00 giờ Việt Nam cho users có subscription active.
Schedule::call(function () {
    $digestDate = Carbon::now('Asia/Ho_Chi_Minh');

    $users = User::query()
        ->whereNotNull('email')
        ->whereHas('sourceSubscriptions', function ($subscriptionQuery): void {
            $subscriptionQuery->whereHas('source', function ($sourceQuery): void {
                $sourceQuery->where('status', 'active');
            });
        })
        ->get();

    Log::channel('scheduler')->info('Digest delivery fan-out started', [
        'total_users' => $users->count(),
        'date' => $digestDate->toDateString(),
        'scheduled_at_vn' => now('Asia/Ho_Chi_Minh')->toDateTimeString(),
    ]);

    $users->each(function (User $user) use ($digestDate): void {
        SendDigestEmailJob::dispatch($user, $digestDate->copy());
    });

    Log::channel('scheduler')->info('Digest delivery fan-out completed', [
        'dispatched_jobs' => $users->count(),
        'date' => $digestDate->toDateString(),
    ]);
})
    ->name('digest:delivery-fanout')
    ->description('Fan-out SendDigestEmailJob for users with active subscriptions')
    ->dailyAt('08:00')
    ->timezone('Asia/Ho_Chi_Minh')
    ->withoutOverlapping(60)
    ->onOneServer();

// Fan-out gửi digest Telegram 08:00 VN — chỉ Power, đã nối bot, cùng điều kiện subscription như email.
Schedule::call(function () {
    $digestDate = Carbon::now('Asia/Ho_Chi_Minh');

    $users = User::query()
        ->where('plan', 'power')
        ->whereNotNull('telegram_chat_id')
        ->where('telegram_chat_id', '!=', '')
        ->whereHas('sourceSubscriptions', function ($subscriptionQuery): void {
            $subscriptionQuery->whereHas('source', function ($sourceQuery): void {
                $sourceQuery->where('status', 'active');
            });
        })
        ->get();

    Log::channel('scheduler')->info('Telegram digest fan-out started', [
        'total_users' => $users->count(),
        'date' => $digestDate->toDateString(),
        'scheduled_at_vn' => now('Asia/Ho_Chi_Minh')->toDateTimeString(),
    ]);

    $users->each(function (User $user) use ($digestDate): void {
        SendTelegramDigestJob::dispatch($user, $digestDate->copy());
    });

    Log::channel('scheduler')->info('Telegram digest fan-out completed', [
        'dispatched_jobs' => $users->count(),
        'date' => $digestDate->toDateString(),
    ]);
})
    ->name('digest:telegram-fanout')
    ->description('Fan-out SendTelegramDigestJob for Power users with Telegram connected')
    ->dailyAt('08:00')
    ->timezone('Asia/Ho_Chi_Minh')
    ->withoutOverlapping(60)
    ->onOneServer();

// Tiến trình lấy avatar từ API twitterapi.io và lưu vào users và sources tự động
// Schedule::command('sources:backfill-avatars --only-missing --limit=50')
//     ->name('sources:avatar-backfill')
//     ->dailyAt('03:30') // Chạy lúc rạng sáng để tránh xung đột
//     ->timezone('Asia/Ho_Chi_Minh')
//     ->withoutOverlapping(120)
//     ->before(function () {
//         Log::channel('scheduler')->info('Avatar backfill starting - Bulk Mode Enabled');
//     })
//     ->onSuccess(function () {
//         Log::channel('scheduler')->info('Avatar backfill completed successfully');
//     })
//     ->onFailure(function () {
//         Log::channel('scheduler')->error('Avatar backfill failed - Check twitterapi.io credits');
//     });
