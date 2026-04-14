<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Source;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SourceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_creates_user_source_in_pending_review_status(): void
    {
        $user = User::factory()->create([
            'plan' => 'pro',
        ]);
        $category = Category::query()->create([
            'name' => 'AI',
            'slug' => 'ai',
            'description' => null,
            'tenant_id' => 1,
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/sources', [
            'handle' => '@newsource',
            'category_ids' => [$category->id],
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.status', 'pending_review');

        $this->assertDatabaseHas('sources', [
            'x_handle' => 'newsource',
            'type' => 'user',
            'status' => 'pending_review',
            'added_by_user_id' => $user->id,
        ]);
    }

    public function test_browse_sources_hides_pending_review_status(): void
    {
        Source::query()->create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'activekol',
            'account_url' => 'https://x.com/activekol',
            'tenant_id' => 1,
        ]);
        Source::query()->create([
            'type' => 'user',
            'status' => 'pending_review',
            'x_handle' => 'pendingkol',
            'account_url' => 'https://x.com/pendingkol',
            'tenant_id' => 1,
        ]);

        $response = $this->getJson('/api/sources');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.x_handle', 'activekol');
    }
}
