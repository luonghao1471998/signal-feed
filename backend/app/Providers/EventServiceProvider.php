<?php

namespace App\Providers;

use App\Events\DraftCopied;
use App\Events\SourceModerated;
use App\Listeners\LogUserInteraction;
use App\Listeners\NotifySubmitterOnModeration;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    /**
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        DraftCopied::class => [
            LogUserInteraction::class,
        ],
        SourceModerated::class => [
            NotifySubmitterOnModeration::class,
        ],
    ];

    /**
     * Disable listener auto-discovery so listeners in app/Listeners are not
     * registered twice alongside $listen mappings.
     */
    public function shouldDiscoverEvents(): bool
    {
        return false;
    }

    public function boot(): void
    {
        //
    }
}
