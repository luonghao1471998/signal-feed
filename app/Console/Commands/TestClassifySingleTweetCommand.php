<?php

namespace App\Console\Commands;

use App\Integrations\LLMClient;
use App\Models\Tweet;
use Illuminate\Console\Command;

/**
 * Gọi Anthropic classify cho đúng một tweet — tốn credits; chỉ dùng verify tích hợp.
 */
class TestClassifySingleTweetCommand extends Command
{
    protected $signature = 'test:classify {id : Internal tweets.id (PK)}';

    protected $description = '⚠️  One real Anthropic classify call for a single tweet (costs credits)';

    public function handle(): int
    {
        if (config('app.mock_llm') === true) {
            $this->error('MOCK_LLM=true — tắt mock hoặc dùng Pipeline với FakeLLMClient. Không gọi API từ lệnh này khi mock bật.');

            return self::FAILURE;
        }

        $id = (int) $this->argument('id');
        $tweet = Tweet::query()->find($id);
        if ($tweet === null) {
            $this->error("Tweet id={$id} not found.");

            return self::FAILURE;
        }

        $this->warn('⚠️  Lệnh này gọi Anthropic API và tốn credits.');
        if (! $this->confirm('Continue?', false)) {
            return self::SUCCESS;
        }

        $client = app(LLMClient::class);
        $result = $client->classify($tweet->text);

        $this->line('signal_score: '.(string) $result['signal_score']);
        $this->line('is_signal: '.($result['is_signal'] ? 'true' : 'false'));

        if ($this->confirm('Ghi vào DB (signal_score + is_signal)?', false)) {
            $tweet->update([
                'signal_score' => $result['signal_score'],
                'is_signal' => $result['is_signal'],
            ]);
            $this->info('Đã cập nhật tweet.');
        }

        return self::SUCCESS;
    }
}
