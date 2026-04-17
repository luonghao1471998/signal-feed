<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Category;
use App\Models\Source;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sources_returns_401_when_guest(): void
    {
        $response = $this->getJson('/admin/api/sources');

        $response->assertStatus(401);
    }

    public function test_admin_sources_returns_200_for_admin_session(): void
    {
        $admin = Admin::factory()->create(['password' => 'password']);

        $response = $this->actingAs($admin, 'admin')->getJson('/admin/api/source-moderation?type=user');

        $response->assertOk();
        $response->assertJsonStructure([
            'data',
            'links',
            'meta',
        ]);
    }

    public function test_admin_can_flag_spam_on_active_user_source(): void
    {
        $admin = Admin::factory()->create(['password' => 'password']);
        $owner = User::factory()->create();

        $source = Source::query()->create([
            'type' => 'user',
            'status' => 'active',
            'x_handle' => 'spamtest',
            'account_url' => 'https://twitter.com/spamtest',
            'added_by_user_id' => $owner->id,
            'tenant_id' => 1,
        ]);

        $response = $this->actingAs($admin, 'admin')->patchJson("/admin/api/source-moderation/{$source->id}", [
            'action' => 'flag_spam',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.status', 'spam');

        $this->assertDatabaseHas('sources', [
            'id' => $source->id,
            'status' => 'spam',
        ]);
    }

    public function test_admin_pipeline_status_returns_401_when_guest(): void
    {
        $response = $this->getJson('/admin/api/pipeline/status');

        $response->assertStatus(401);
    }

    public function test_admin_pipeline_status_returns_metrics_for_admin(): void
    {
        $admin = Admin::factory()->create(['password' => 'password']);

        $response = $this->actingAs($admin, 'admin')->getJson('/admin/api/pipeline/status');

        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                'last_run_timestamp',
                'tweets_fetched_count',
                'signals_created_count',
                'error_rate',
                'per_category_signal_volume',
            ],
        ]);
    }

    public function test_admin_can_adjust_categories(): void
    {
        $admin = Admin::factory()->create(['password' => 'password']);

        $c1 = Category::query()->create([
            'name' => 'Cat A',
            'slug' => 'cat-a',
            'description' => null,
            'tenant_id' => 1,
        ]);
        $c2 = Category::query()->create([
            'name' => 'Cat B',
            'slug' => 'cat-b',
            'description' => null,
            'tenant_id' => 1,
        ]);

        $source = Source::query()->create([
            'type' => 'user',
            'status' => 'active',
            'x_handle' => 'cattest',
            'account_url' => 'https://twitter.com/cattest',
            'tenant_id' => 1,
        ]);
        $source->categories()->sync([$c1->id]);

        $response = $this->actingAs($admin, 'admin')->patchJson("/admin/api/source-moderation/{$source->id}", [
            'action' => 'adjust_categories',
            'category_ids' => [$c2->id],
        ]);

        $response->assertOk();
        $this->assertEquals([$c2->id], $source->fresh()->categories->pluck('id')->all());
    }
}
