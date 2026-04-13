<?php

namespace App\Listeners;

use App\Events\DraftCopied;
use App\Models\UserInteraction;

class LogUserInteraction
{
    public function handle(DraftCopied $event): void
    {
        UserInteraction::query()->create([
            'user_id' => $event->user->id,
            'signal_id' => $event->signal->id,
            'action' => 'copy_draft',
            'metadata' => [
                'draft_id' => $event->draft->id,
                'signal_id' => $event->signal->id,
            ],
            'tenant_id' => $event->user->tenant_id ?? 1,
            'created_at' => now()->utc(),
        ]);
    }
}
