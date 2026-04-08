<?php

namespace App\Console\Commands;

use App\Models\Tweet;
use Illuminate\Console\Command;

class CreateTestTweetsCommand extends Command
{
    protected $signature = 'test:create-tweets';
    
    public function handle()
    {
        $texts = [
            'Google announces Gemini 2.0 with breakthrough reasoning',
            'Just had lunch with the team',
            'Anthropic raises $4B Series C led by Amazon',
            'Check out my new course! 50% off',
            'Microsoft acquires GitHub competitor for $10B'
        ];

        foreach ($texts as $i => $text) {
            Tweet::create([
                'tweet_id' => 'test_new_' . time() . '_' . $i,
                'text' => $text,
                'posted_at' => now(),
                'url' => "https://x.com/test/status/" . ($i + 1),
                'source_id' => 9
            ]);
            sleep(1);
        }

        $this->info('Created 5 test tweets');
    }
}
