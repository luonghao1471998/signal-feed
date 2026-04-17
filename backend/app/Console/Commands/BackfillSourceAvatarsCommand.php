<?php

namespace App\Console\Commands;

use App\Models\Source;
use App\Services\TwitterCrawlerService;
use Illuminate\Console\Command;

class BackfillSourceAvatarsCommand extends Command
{
    // Giảm limit xuống 50 vì các API thường giới hạn 50-100 user/request
    protected $signature = 'sources:backfill-avatars
                            {--limit=50 : Maximum number of sources to process}
                            {--only-missing : Process only sources without avatar_url}';

    protected $description = 'Backfill avatar_url for sources using Bulk API to save credits';

    public function __construct(
        private readonly TwitterCrawlerService $crawler
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $onlyMissing = (bool) $this->option('only-missing');

        $query = Source::query()
            ->forCrawl()
            ->orderBy('id');

        if ($onlyMissing) {
            $query->where(function ($q): void {
                $q->whereNull('avatar_url')
                    ->orWhere('avatar_url', '');
            });
        }

        $sources = $query->limit($limit)->get();

        if ($sources->isEmpty()) {
            $this->info('No matching sources to backfill.');

            return self::SUCCESS;
        }

        $this->info("Processing {$sources->count()} sources in bulk...");

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
