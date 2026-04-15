<?php

namespace App\Console\Commands;

use App\Models\Source;
use App\Services\TwitterCrawlerService;
use Illuminate\Console\Command;

class BackfillSourceAvatarsCommand extends Command
{
    protected $signature = 'sources:backfill-avatars
                            {--limit=100 : Maximum number of sources to process}
                            {--only-missing : Process only sources without avatar_url}
                            {--sleep=1 : Seconds between API calls}';

    protected $description = 'Backfill/sync avatar_url for sources from twitterapi.io metadata';

    public function __construct(
        private readonly TwitterCrawlerService $crawler
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $sleep = max(0, (int) $this->option('sleep'));
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

        $ok = 0;
        $failed = 0;

        foreach ($sources as $index => $source) {
            $success = $this->crawler->refreshSourceProfile($source);
            if ($success) {
                $ok++;
                $this->line(sprintf('✓ @%s', $source->x_handle));
            } else {
                $failed++;
                $this->warn(sprintf('✗ @%s', $source->x_handle));
            }

            $isLast = $index === $sources->count() - 1;
            if (! $isLast && $sleep > 0) {
                sleep($sleep);
            }
        }

        $this->table(['Processed', 'Success', 'Failed'], [[(string) $sources->count(), (string) $ok, (string) $failed]]);

        return $failed > 0 && $ok === 0 ? self::FAILURE : self::SUCCESS;
    }
}

