<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\TwitterCrawlerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class BackfillUserEmailsCommand extends Command
{
    protected $signature = 'users:backfill-emails
                            {--limit=50 : Maximum number of users to process}
                            {--only-missing : Process only users without email}';

    protected $description = 'Backfill users.email from X.com profile metadata';

    public function __construct(
        private readonly TwitterCrawlerService $crawler
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $onlyMissing = (bool) $this->option('only-missing');

        $query = User::query()
            ->whereNotNull('x_username')
            ->where('x_username', '!=', '')
            ->orderBy('id');

        if ($onlyMissing) {
            $query->where(function ($q): void {
                $q->whereNull('email')
                    ->orWhere('email', '');
            });
        }

        $users = $query->limit($limit)->get();

        if ($users->isEmpty()) {
            $this->info('No matching users to backfill.');

            return self::SUCCESS;
        }

        $this->info("Processing {$users->count()} users...");

        $updated = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($users as $user) {
            try {
                $profile = $this->crawler->fetchProfileMetadata((string) $user->x_username);
                $email = $profile['email'] ?? null;

                if (! is_string($email) || $email === '') {
                    $skipped++;
                    continue;
                }

                if ((string) $user->email === $email) {
                    $skipped++;
                    continue;
                }

                $user->email = $email;
                $user->save();
                $updated++;
            } catch (\Throwable $e) {
                $failed++;
                Log::channel('crawler-errors')->warning('BackfillUserEmailsCommand failed for user', [
                    'user_id' => $user->id,
                    'x_username' => $user->x_username,
                    'message' => $e->getMessage(),
                ]);
            }
        }

        $this->table(
            ['Total', 'Updated', 'Skipped', 'Failed'],
            [[(string) $users->count(), (string) $updated, (string) $skipped, (string) $failed]]
        );

        return $failed > 0 && $updated === 0 ? self::FAILURE : self::SUCCESS;
    }
}
