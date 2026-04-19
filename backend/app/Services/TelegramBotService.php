<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramBotService
{
    public function sendMessage(string $chatId, string $text, ?string $parseMode = 'HTML'): bool
    {
        $token = (string) config('services.telegram.bot_token');
        if ($token === '') {
            Log::error('Telegram: TELEGRAM_BOT_TOKEN is not configured');

            return false;
        }

        $url = sprintf('https://api.telegram.org/bot%s/sendMessage', $token);

        $payload = [
            'chat_id' => $chatId,
            'text' => $text,
            'disable_web_page_preview' => true,
        ];
        if ($parseMode !== null && $parseMode !== '') {
            $payload['parse_mode'] = $parseMode;
        }

        $response = Http::asJson()
            ->timeout(30)
            ->post($url, $payload);

        if (! $response->successful()) {
            Log::warning('Telegram sendMessage failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        }

        return true;
    }
}
