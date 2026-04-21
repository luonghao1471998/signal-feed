<?php

namespace App\Console\Commands;

use App\Models\Source;
use App\Services\TwitterCrawlerService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class BackfillSourceAvatarsCommand extends Command
{
    protected $signature = 'sources:backfill-avatars
                            {--limit=50 : Maximum number of sources to process}
                            {--only-missing : Process only sources without avatar_url}
                            {--force : Ignore avatar_synced_at freshness check and process all matched sources}';

    protected $description = 'Backfill avatar_url for sources — skips sources with avatar synced within 7 days (use --force to override)';

    public function __construct(
        private readonly TwitterCrawlerService $crawler
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $onlyMissing = (bool) $this->option('only-missing');
        $force = (bool) $this->option('force');

        $query = Source::query()
            ->forCrawl()
            ->orderBy('id');

        if ($onlyMissing) {
            $query->where(function ($q): void {
                $q->whereNull('avatar_url')
                    ->orWhere('avatar_url', '');
            });
        }

        // Bỏ qua source đã sync avatar trong 7 ngày gần đây (trừ khi --force).
        // Tiết kiệm credit: không gọi API cho source mà avatar đã "đủ mới".
        if (! $force) {
            $freshCutoff = Carbon::now()->subDays(7);
            $query->where(function ($q) use ($freshCutoff): void {
                $q->whereNull('avatar_synced_at')
                    ->orWhere('avatar_synced_at', '<=', $freshCutoff);
            });
        }

        $sources = $query->limit($limit)->get();

        if ($sources->isEmpty()) {
            $this->info('No sources need avatar backfill (all synced within 7 days). Use --force to override.');

            return self::SUCCESS;
        }

        $forceNote = $force ? ' [--force: freshness check bypassed]' : '';
        $this->info("Processing {$sources->count()} sources in bulk...{$forceNote}");

        // Gửi danh sách cho Service xử lý gom nhóm API
        // Giả sử hàm syncMultipleProfiles sẽ trả về số lượng thành công
        $results = $this->crawler->syncMultipleProfiles($sources);

        $ok = $results['success'] ?? 0;
        $failed = $results['failed'] ?? 0;

        $this->table(
            ['Total', 'Success (Updated/Synced)', 'Failed'],
            [[(string) $sources->count(), (string) $ok, (string) $failed]]
        );

        return $failed > 0 && $ok === 0 ? self::FAILURE : self::SUCCESS;
    }
}
