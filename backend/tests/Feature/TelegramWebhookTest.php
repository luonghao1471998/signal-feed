<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TelegramWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.telegram.bot_token' => 'test-token',
            'services.telegram.webhook_secret' => '',
        ]);
        Http::fake([
            'api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);
    }

    public function test_plain_token_connects_power_user(): void
    {
        $token = 'sf_'.str_repeat('a', 16);
        $user = User::factory()->create([
            'plan' => 'power',
            'telegram_connect_token' => $token,
            'telegram_chat_id' => null,
        ]);

        $this->postJson('/api/webhooks/telegram', [
            'update_id' => 1001,
            'message' => [
                'message_id' => 1,
                'text' => $token,
                'chat' => ['id' => 999888777],
            ],
        ])->assertOk();

        $user->refresh();
        $this->assertSame('999888777', $user->telegram_chat_id);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'sendMessage')
                && str_contains($request->body(), 'Connected');
        });
    }

    public function test_slash_connect_command_parses_token(): void
    {
        $token = 'sf_'.str_repeat('b', 16);
        $user = User::factory()->create([
            'plan' => 'power',
            'telegram_connect_token' => $token,
        ]);

        $this->postJson('/api/webhooks/telegram', [
            'update_id' => 1002,
            'message' => [
                'message_id' => 2,
                'text' => '/connect@SignalFeedBot '.$token,
                'chat' => ['id' => 111],
            ],
        ])->assertOk();

        $user->refresh();
        $this->assertSame('111', $user->telegram_chat_id);
    }

    public function test_duplicate_update_id_is_idempotent(): void
    {
        $token = 'sf_'.str_repeat('c', 16);
        $user = User::factory()->create([
            'plan' => 'power',
            'telegram_connect_token' => $token,
        ]);

        $payload = [
            'update_id' => 2001,
            'message' => [
                'message_id' => 3,
                'text' => $token,
                'chat' => ['id' => 222],
            ],
        ];

        $this->postJson('/api/webhooks/telegram', $payload)->assertOk();

        $this->postJson('/api/webhooks/telegram', $payload)->assertOk();

        Http::assertSentCount(1);
    }

    public function test_non_power_user_gets_denied_message(): void
    {
        $token = 'sf_'.str_repeat('d', 16);
        User::factory()->create([
            'plan' => 'pro',
            'telegram_connect_token' => $token,
        ]);

        $this->postJson('/api/webhooks/telegram', [
            'update_id' => 3001,
            'message' => [
                'message_id' => 4,
                'text' => $token,
                'chat' => ['id' => 333],
            ],
        ])->assertOk();

        Http::assertSent(function ($request) {
            return str_contains($request->body(), 'Power plan');
        });
    }
}
