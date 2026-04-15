<?php

/*
|--------------------------------------------------------------------------
| API routes (prefix /api) — SignalFeed
|--------------------------------------------------------------------------
| Domain endpoints are added in later roadmap tasks (1.4+, 1.10+, …).
*/

use App\Http\Controllers\Api\Admin\AdminPipelineController;
use App\Http\Controllers\Api\Admin\AdminSourceController;
use App\Http\Controllers\Api\ArchiveController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CurrentUserController;
use App\Http\Controllers\Api\DraftController;
use App\Http\Controllers\Api\MySourcesController;
use App\Http\Controllers\Api\SignalController;
use App\Http\Controllers\Api\SourceController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\UpdateCurrentUserController;
use Illuminate\Support\Facades\Route;

Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/sources', [SourceController::class, 'index']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/me', CurrentUserController::class);
    Route::patch('/me', UpdateCurrentUserController::class);
    Route::post('/sources', [SourceController::class, 'store']);
    Route::get('/sources/my-submissions', [SourceController::class, 'mySubmissions']);
    Route::post('/sources/{sourceId}/subscribe', [SubscriptionController::class, 'subscribe'])
        ->whereNumber('sourceId');
    Route::post('/sources/bulk-subscribe', [SubscriptionController::class, 'bulkSubscribe']);
    Route::delete('/sources/{sourceId}/subscribe', [SubscriptionController::class, 'unsubscribe'])
        ->whereNumber('sourceId');
    Route::get('/my-sources', [MySourcesController::class, 'index']);
    Route::get('/my-sources/stats', [MySourcesController::class, 'stats']);
    Route::get('/archive/signals', [ArchiveController::class, 'index']);
    Route::get('/signals', [SignalController::class, 'index']);
    Route::post('/signals/{id}/archive', [ArchiveController::class, 'store'])->whereNumber('id');
    Route::delete('/signals/{id}/archive', [ArchiveController::class, 'destroy'])->whereNumber('id');
    Route::post('/signals/{id}/draft/copy', [DraftController::class, 'copy'])->whereNumber('id');
    Route::get('/signals/{id}', [SignalController::class, 'show'])->whereNumber('id');

    Route::middleware('admin')->prefix('admin')->group(function (): void {
        Route::get('/sources', [AdminSourceController::class, 'index']);
        Route::patch('/sources/{source}', [AdminSourceController::class, 'update'])->whereNumber('source');
        Route::get('/pipeline/status', [AdminPipelineController::class, 'status']);
    });
});
