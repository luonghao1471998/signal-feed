<?php

namespace Tests\Feature;

use Illuminate\Console\Scheduling\Schedule;
use Tests\TestCase;

class SchedulerTest extends TestCase
{
    public function test_scheduler_registered(): void
    {
        $schedules = $this->app->make(Schedule::class)->events();

        $hasCrawler = collect($schedules)->contains(fn ($e) => str_contains($e->command ?? '', 'tweets:crawl'));

        $this->assertTrue($hasCrawler);
    }

    public function test_schedule_timing(): void
    {
        $schedules = $this->app->make(Schedule::class)->events();

        $event = collect($schedules)->first(fn ($e) => str_contains($e->command ?? '', 'tweets:crawl'));

        $this->assertNotNull($event);
        $this->assertEquals('0 1,7,13,19 * * *', $event->expression);
        $this->assertEquals('Asia/Ho_Chi_Minh', $event->timezone);
    }
}
