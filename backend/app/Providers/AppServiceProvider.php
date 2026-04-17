<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (app()->environment(['production', 'staging']) && empty(config('services.resend.key'))) {
            logger()->warning('RESEND_API_KEY is not configured. Email digest delivery will fail.');
        }
    }
}
