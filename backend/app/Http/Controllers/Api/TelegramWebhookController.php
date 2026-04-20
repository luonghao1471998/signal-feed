<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\TelegramBotService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class TelegramWebhookController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLog,
        private readonly TelegramBotService $telegram
    ) {}

    public function handle(Request $request): Response
    {
        $secret = (string) config('services.telegram.webhook_secret');
        if ($secret !== '') {
            $providedSecret = (string) ($request->header('X-Telegram-Bot-Api-Secret-Token') ?? $request->query('secret', ''));
            if ($providedSecret === '' || ! hash_equals($secret, $providedSecret)) {
                Log::warning('Telegram webhook rejected due to invalid secret token');

                return response('', 403);
            }
        }

        if ((string) config('services.telegram.bot_token') === '') {
            Log::error('Telegram webhook: TELEGRAM_BOT_TOKEN is not configured');

            return response('OK', 200);
        }

        $payload = $request->all();
        $updateId = (int) ($payload['update_id'] ?? 0);
        if ($updateId === 0) {
            return response('OK', 200);
        }

        $message = $payload['message'] ?? $payload['edited_message'] ?? null;
        if (! is_array($message)) {
            return response('OK', 200);
        }

        $text = isset($message['text']) ? trim((string) $message['text']) : '';
        if ($text === '') {
            return response('OK', 200);
        }

        $chatId = (string) ($message['chat']['id'] ?? '');
        if ($chatId === '') {
            return response('OK', 200);
        }

        if (! $this->shouldProcessUpdate($updateId)) {
            return response('OK', 200);
        }

        try {
            $this->processConnectMessage($text, $chatId);
        } catch (\Throwable $e) {
            Log::error('Telegram webhook failed', ['error' => $e->getMessage()]);
        }

        return response('OK', 200);
    }

    private function shouldProcessUpdate(int $updateId): bool
    {
        if ($updateId === 0) {
            return true;
        }

        try {
            if (! Schema::hasTable('processed_telegram_updates')) {
                return true;
            }

            $inserted = DB::table('processed_telegram_updates')->insertOrIgnore([
                'update_id' => $updateId,
                'created_at' => now(),
            ]);

            return $inserted === 1;
        } catch (\Throwable $e) {
            Log::warning('Telegram webhook idempotency fallback: unable to persist update id', [
                'update_id' => $updateId,
                'error' => $e->getMessage(),
            ]);

            return true;
        }
    }

    private function processConnectMessage(string $text, string $chatId): void
    {
        $token = $this->extractToken($text);
        if ($token === null) {
            return;
        }

        $user = User::query()->where('telegram_connect_token', $token)->first();
        if ($user === null) {
            $this->telegram->sendMessage(
                $chatId,
                'Invalid or expired token. Open SignalFeed → Settings → Telegram and copy your current token.',
                null,
            );
            $this->auditLog->log(
                eventType: 'telegram.connect.invalid_token',
                userId: null,
                entityType: 'User',
                entityId: null,
                metadata: [
                    'chat_id' => $chatId,
                    'token_prefix' => substr($token, 0, 6).'…',
                ]
            );

            return;
        }

        if ((string) $user->plan !== 'power') {
            $this->telegram->sendMessage(
                $chatId,
                'Telegram digest alerts require a Power plan. Upgrade in SignalFeed → Settings → Plan & Billing.',
                null,
            );
            $this->auditLog->log(
                eventType: 'telegram.connect.denied_plan',
                userId: $user->id,
                entityType: 'User',
                entityId: $user->id,
                metadata: [
                    'plan' => $user->plan,
                    'chat_id' => $chatId,
                ]
            );

            return;
        }

        $user->telegram_chat_id = $chatId;
        $user->save();

        $this->telegram->sendMessage(
            $chatId,
            'Connected. You will receive the same daily digest as email at 8:00 AM Vietnam time.',
            null,
        );

        $this->auditLog->log(
            eventType: 'telegram.connect.success',
            userId: $user->id,
            entityType: 'User',
            entityId: $user->id,
            metadata: [
                'chat_id' => $chatId,
            ]
        );
    }

    private function extractToken(string $text): ?string
    {
        if (preg_match('/^\/connect(?:@\S+)?\s+(\S+)/i', $text, $m)) {
            return strtolower($m[1]);
        }

        if (preg_match('/^sf_[a-z0-9]+$/i', $text)) {
            return strtolower($text);
        }

        return null;
    }
}
