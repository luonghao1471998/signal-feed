<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'x_user_id' => (string) fake()->unique()->numberBetween(1_000_000_000, 9_999_999_999),
            'x_username' => fake()->unique()->userName(),
            'x_access_token' => null,
            'x_refresh_token' => null,
            'x_token_expires_at' => null,
            'plan' => 'free',
            'my_categories' => [],
            'delivery_preferences' => [],
            'is_admin' => false,
            'tenant_id' => 1,
        ];
    }
}
