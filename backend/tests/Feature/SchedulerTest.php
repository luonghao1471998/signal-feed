<?php

namespace Tests\Feature;

use Illuminate\Console\Scheduling\Schedule;
use Tests\TestCase;

class SchedulerTest extends TestCase
{
    public function test_scheduler_registered(): void
    {
        $schedules = $this->app->make(Schedule::class)->events();

        $hasPipeline = collect($schedules)->contains(
            fn ($e) => ($e->description ?? '') === 'pipeline:crawl-classify'
        );

        $this->assertTrue($hasPipeline);
    }

    public function test_schedule_timing(): void
    {
        $schedules = $this->app->make(Schedule::class)->events();

        $event = collect($schedules)->first(
            fn ($e) => ($e->description ?? '') === 'pipeline:crawl-classify'
        );

        $this->assertNotNull($event);
        $this->assertEquals('0 1,7,13,19 * * *', $event->expression);
        $this->assertEquals('Asia/Ho_Chi_Minh', $event->timezone);
    }

    public function test_telegram_digest_fanout_schedule_registered(): void
    {
        $schedules = $this->app->make(Schedule::class)->events();

        $found = collect($schedules)->contains(
            fn ($e) => str_contains((string) ($e->description ?? ''), 'SendTelegramDigestJob')
        );

        $this->assertTrue($found);
    }
}
