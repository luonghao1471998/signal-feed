<?php

namespace Tests\Feature;

use App\Models\Digest;
use App\Models\DraftTweet;
use App\Models\Signal;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DraftCopyApiTest extends TestCase
{
    use DatabaseTransactions;

    private function seedSignalWithDraft(?string $draftText = null): Signal
    {
        $digest = Digest::query()->create([
            'date' => now()->toDateString(),
            'total_signals' => 0,
            'tenant_id' => 1,
        ]);

        $signal = Signal::query()->create([
            'digest_id' => $digest->id,
            'cluster_id' => 'cluster_test_1',
            'title' => 'Test signal',
            'summary' => 'Summary text',
            'source_count' => 1,
            'tenant_id' => 1,
        ]);

        DraftTweet::query()->create([
            'signal_id' => $signal->id,
            'text' => $draftText ?? 'Hello world with spaces',
            'tenant_id' => 1,
        ]);

        return $signal->fresh(['draft']);
    }

    public function test_pro_user_gets_twitter_intent_url_and_logs_interaction(): void
    {
        $user = User::factory()->create(['plan' => 'pro']);
        $signal = $this->seedSignalWithDraft('Line one Line two 🚀');

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/signals/{$signal->id}/draft/copy");

        $response->assertOk();
        $url = $response->json('data.twitter_intent_url');
        $this->assertIsString($url);
        $this->assertStringStartsWith('https://x.com/intent/post?text=', $url);

        $query = parse_url($url, PHP_URL_QUERY);
        $this->assertIsString($query);
        parse_str($query, $params);
        $this->assertArrayHasKey('text', $params);
        $this->assertSame('Line one Line two 🚀', $params['text']);

        $this->assertDatabaseHas('user_interactions', [
            'user_id' => $user->id,
            'signal_id' => $signal->id,
            'action' => 'copy_draft',
        ]);

        $row = DB::table('user_interactions')
            ->where('user_id', $user->id)
            ->where('signal_id', $signal->id)
            ->first();
        $this->assertNotNull($row);
        $meta = json_decode((string) $row->metadata, true);
        $this->assertIsArray($meta);
        $this->assertSame($signal->draft?->id, $meta['draft_id'] ?? null);
    }

    public function test_free_user_gets_403(): void
    {
        $user = User::factory()->create(['plan' => 'free']);
        $signal = $this->seedSignalWithDraft();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/signals/{$signal->id}/draft/copy");

        $response->assertStatus(403);
        $response->assertJson([
            'message' => 'Draft access is available for Pro/Power users only. Upgrade to access this feature.',
        ]);
    }

    public function test_missing_signal_returns_404(): void
    {
        $user = User::factory()->create(['plan' => 'pro']);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/signals/999999/draft/copy');

        $response->assertStatus(404);
    }

    public function test_signal_without_draft_returns_404(): void
    {
        $user = User::factory()->create(['plan' => 'pro']);
        $digest = Digest::query()->create([
            'date' => now()->toDateString(),
            'total_signals' => 0,
            'tenant_id' => 1,
        ]);
        $signal = Signal::query()->create([
            'digest_id' => $digest->id,
            'cluster_id' => 'cluster_no_draft',
            'title' => 'No draft',
            'summary' => 'S',
            'source_count' => 0,
            'tenant_id' => 1,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/signals/{$signal->id}/draft/copy");

        $response->assertStatus(404);
    }

    public function test_long_draft_is_url_encoded(): void
    {
        $user = User::factory()->create(['plan' => 'power']);
        $long = str_repeat('a', 280);
        $signal = $this->seedSignalWithDraft($long);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson("/api/signals/{$signal->id}/draft/copy");

        $response->assertOk();
        $url = $response->json('data.twitter_intent_url');
        $query = parse_url((string) $url, PHP_URL_QUERY);
        $this->assertIsString($query);
        parse_str($query, $params);
        $this->assertSame(280, mb_strlen($params['text'], 'UTF-8'));
    }
}