<?php

namespace App\Jobs;

use App\Mail\DigestEmail;
use App\Models\Signal;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\DigestDeliveryGateService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
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
        DigestDeliveryGateService $deliveryGate
    ): void
    {
        $currentUtc = now()->utc();
        if (! $deliveryGate->shouldDeliverToUser($this->user, $currentUtc)) {
            $auditLog->log(
                eventType: 'digest.email.skipped_tier_restriction',
                userId: $this->user->id,
                entityType: 'User',
                entityId: $this->user->id,
                metadata: [
                    'plan' => $this->user->plan,
                    'date' => $currentUtc->toDateString(),
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

        $signals = $this->fetchSignalsForUser();
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

    protected function fetchSignalsForUser(): Collection
    {
        $date = $this->date->toDateString();
        $isPaid = in_array((string) $this->user->plan, ['pro', 'power'], true);

        $query = Signal::query()
            ->with('sources');

        if (Schema::hasColumn('signals', 'date')) {
            $query->whereDate('signals.date', $date);
        } else {
            $query->whereHas('digest', static function ($digestQuery) use ($date): void {
                $digestQuery->whereDate('digests.date', $date);
            });
        }

        if ($isPaid) {
            $query->where(function ($q): void {
                $q->where('type', 0)
                    ->orWhere(function ($inner): void {
                        $inner->where('type', 1)
                            ->where('user_id', $this->user->id);
                    });
            });
        } else {
            $query->where('type', 0);
        }

        return $query
            ->orderByDesc('rank_score')
            ->limit(10)
            ->get();
    }
}
