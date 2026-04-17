<?php

namespace App\Listeners;

use App\Events\SourceModerated;
use App\Mail\SourceModerationNotification;
use App\Services\AuditLogService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NotifySubmitterOnModeration implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'notifications';

    public int $tries = 3;

    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {
    }

    public function handle(SourceModerated $event): void
    {
        if ($event->submitter === null) {
            return;
        }

        $email = trim((string) ($event->submitter->email ?? ''));
        $emailValid = data_get($event->submitter, 'email_valid');

        if ($email === '' || $emailValid === false) {
            Log::info('Skipped moderation email - invalid email', [
                'source_id' => $event->source->id,
                'user_id' => $event->submitter->id,
            ]);

            return;
        }

        try {
            Mail::to($email)->send(
                new SourceModerationNotification($event->source, $event->action, $event->submitter)
            );
        } catch (\Throwable $e) {
            Log::warning('source moderation notification failed', [
                'source_id' => $event->source->id,
                'action' => $event->action,
                'user_id' => $event->submitter->id,
                'error' => $e->getMessage(),
            ]);

            return;
        }

        $handle = ltrim((string) ($event->source->x_handle ?? ''), '@');
        $this->auditLogService->log(
            'source.moderation.notified',
            $event->submitter->id,
            'source',
            $event->source->id,
            [
                'source_id' => $event->source->id,
                'action' => $event->action,
                'user_email' => $email,
                'handle' => $handle,
            ]
        );
    }
}
