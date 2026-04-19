<?php

/*
|--------------------------------------------------------------------------
| API routes (prefix /api) — SignalFeed
|--------------------------------------------------------------------------
| Domain endpoints are added in later roadmap tasks (1.4+, 1.10+, …).
*/

use App\Http\Controllers\Api\ArchiveController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CurrentUserController;
use App\Http\Controllers\Api\DraftController;
use App\Http\Controllers\Api\MySourcesController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SignalController;
use App\Http\Controllers\Api\SourceController;
use App\Http\Controllers\Api\StripeWebhookController;
use App\Http\Controllers\Api\TelegramWebhookController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\UpdateCurrentUserController;
use Illuminate\Support\Facades\Route;

Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/sources', [SourceController::class, 'index']);

Route::post('/webhooks/stripe', [StripeWebhookController::class, 'handle']);
Route::post('/webhooks/telegram', [TelegramWebhookController::class, 'handle']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/me', CurrentUserController::class);
    Route::patch('/me', UpdateCurrentUserController::class);
    Route::post('/sources', [SourceController::class, 'store'])->middleware('plan_features:add_source');
    Route::get('/sources/my-submissions', [SourceController::class, 'mySubmissions']);
    Route::post('/sources/{sourceId}/subscribe', [SubscriptionController::class, 'subscribe'])
        ->whereNumber('sourceId');
    Route::post('/sources/bulk-subscribe', [SubscriptionController::class, 'bulkSubscribe']);
    Route::delete('/sources/{sourceId}/subscribe', [SubscriptionController::class, 'unsubscribe'])
        ->whereNumber('sourceId');
    Route::get('/my-sources', [MySourcesController::class, 'index']);
    Route::get('/my-sources/stats', [MySourcesController::class, 'stats']);
    Route::get('/archive/signals', [ArchiveController::class, 'index']);
    Route::get('/settings', [SettingsController::class, 'show']);
    Route::patch('/settings', [SettingsController::class, 'update']);
    Route::get('/signals', [SignalController::class, 'index']);
    Route::post('/signals/{id}/archive', [ArchiveController::class, 'store'])->whereNumber('id');
    Route::delete('/signals/{id}/archive', [ArchiveController::class, 'destroy'])->whereNumber('id');
    Route::post('/signals/{id}/draft/copy', [DraftController::class, 'copy'])
        ->middleware('plan_features:draft_copy')
        ->whereNumber('id');
    Route::get('/signals/{id}', [SignalController::class, 'show'])->whereNumber('id');
    Route::post('/billing/checkout', [BillingController::class, 'checkout']);
    Route::post('/billing/portal', [BillingController::class, 'portal']);
    Route::get('/billing/history', [BillingController::class, 'history']);
    Route::post('/subscriptions/upgrade', [SubscriptionController::class, 'upgradeSubscription']);
});
