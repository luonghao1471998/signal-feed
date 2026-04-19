<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\AuditLogService;
use App\Services\DigestDeliveryGateService;
use App\Services\DigestSignalsService;
use App\Services\TelegramBotService;
use App\Services\TelegramDigestChunker;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\View;
use Throwable;

class SendTelegramDigestJob implements ShouldQueue
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
        DigestSignalsService $digestSignals,
        TelegramBotService $telegram,
        TelegramDigestChunker $chunker
    ): void {
        $currentUtc = now()->utc();
        if (! $deliveryGate->shouldDeliverToUser($this->user, $currentUtc)) {
            $auditLog->log(
                eventType: 'digest.telegram.skipped_tier_restriction',
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

        if ((string) $this->user->plan !== 'power') {
            $auditLog->log(
                eventType: 'digest.telegram.skipped_tier_restriction',
                userId: $this->user->id,
                entityType: 'User',
                entityId: $this->user->id,
                metadata: [
                    'reason' => 'not_power_plan',
                    'plan' => $this->user->plan,
                    'date' => $this->date->toDateString(),
                ]
            );

            return;
        }

        $chatId = (string) ($this->user->telegram_chat_id ?? '');
        if ($chatId === '') {
            $auditLog->log(
                eventType: 'digest.telegram.skipped_empty',
                userId: $this->user->id,
                entityType: 'User',
                entityId: $this->user->id,
                metadata: [
                    'reason' => 'telegram_not_connected',
                    'date' => $this->date->toDateString(),
                ]
            );

            return;
        }

        $signals = $digestSignals->signalsForUserOnDate($this->user, $this->date);
        if ($signals->isEmpty()) {
            $auditLog->log(
                eventType: 'digest.telegram.skipped_empty',
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

        $appUrl = rtrim((string) (config('app.frontend_url') ?: config('app.url', 'http://localhost:8000')), '/');

        $html = View::make('telegram.digest', [
            'user' => $this->user,
            'signals' => $signals,
            'date' => $this->date,
            'appUrl' => $appUrl,
        ])->render();

        $chunks = $chunker->chunk([$html]);
        $start = microtime(true);
        $allOk = true;

        foreach ($chunks as $chunk) {
            if (! $telegram->sendMessage($chatId, $chunk, 'HTML')) {
                $allOk = false;
                break;
            }
        }

        $durationMs = (int) ((microtime(true) - $start) * 1000);

        if (! $allOk) {
            throw new \RuntimeException('Telegram sendMessage returned failure');
        }

        $auditLog->log(
            eventType: 'digest.telegram.sent',
            userId: $this->user->id,
            entityType: 'User',
            entityId: $this->user->id,
            metadata: [
                'signal_count' => $signals->count(),
                'duration_ms' => $durationMs,
                'date' => $this->date->toDateString(),
                'chunk_count' => count($chunks),
            ]
        );
    }

    public function failed(Throwable $e): void
    {
        app(AuditLogService::class)->log(
            eventType: 'digest.telegram.failed',
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
