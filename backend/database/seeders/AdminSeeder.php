<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL', 'admin@signalfeed.test');
        $password = env('ADMIN_PASSWORD', 'changeme');

        if (Admin::query()->where('email', $email)->exists()) {
            return;
        }

        Admin::query()->create([
            'name' => 'Super Admin',
            'email' => $email,
            'password' => $password,
            'role' => 'super_admin',
            'is_active' => true,
        ]);
    }
}
