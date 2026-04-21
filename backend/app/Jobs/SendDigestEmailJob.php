<?php

namespace App\Jobs;

use App\Mail\DigestEmail;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\DigestDeliveryGateService;
use App\Services\DigestSignalsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendDigestEmailJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $timeout = 60;

    public function __construct(
        public User $user,
        public Carbon $date
    ) {
        $this->onQueue('digest-delivery');
    }

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function handle(
        AuditLogService $auditLog,
        DigestDeliveryGateService $deliveryGate,
        DigestSignalsService $digestSignals
    ): void {
        $now = now();
        if (! $deliveryGate->shouldDeliverToUser($this->user, $now)) {
            $auditLog->log(
                eventType: 'digest.email.skipped_tier_restriction',
                userId: $this->user->id,
                entityType: 'User',
                entityId: $this->user->id,
                metadata: [
                    'plan' => $this->user->plan,
                    'date' => $now->toDateString(),
                ]
            );

            return;
        }

        if (empty($this->user->email)) {
            $auditLog->log(
                eventType: 'digest.email.skipped_empty',
                userId: $this->user->id,
                entityType: 'User',
                entityId: $this->user->id,
                metadata: [
                    'reason' => 'user_email_null',
                    'date' => $this->date->toDateString(),
                ]
            );

            return;
        }

        $signals = $digestSignals->signalsForUserOnDate($this->user, $this->date);
        if ($signals->isEmpty()) {
            $auditLog->log(
                eventType: 'digest.email.skipped_empty',
                userId: $this->user->id,
                entityType: 'User',
                entityId: $this->user->id,
                metadata: [
                    'reason' => 'no_signals_for_date',
                    'date' => $this->date->toDateString(),
                ]
            );

            return;
        }

        $start = microtime(true);

        Mail::mailer('resend')
            ->to($this->user->email)
            ->send(new DigestEmail($this->user, $signals, $this->date));

        $durationMs = (int) ((microtime(true) - $start) * 1000);

        $auditLog->log(
            eventType: 'digest.email.sent',
            userId: $this->user->id,
            entityType: 'User',
            entityId: $this->user->id,
            metadata: [
                'signal_count' => $signals->count(),
                'duration_ms' => $durationMs,
                'date' => $this->date->toDateString(),
                'recipient' => $this->user->email,
            ]
        );
    }

    public function failed(Throwable $e): void
    {
        app(AuditLogService::class)->log(
            eventType: 'digest.email.failed',
            userId: $this->user->id,
            entityType: 'User',
            entityId: $this->user->id,
            metadata: [
                'error' => $e->getMessage(),
                'error_class' => $e::class,
                'attempt' => $this->attempts(),
                'date' => $this->date->toDateString(),
            ]
        );
    }

}
