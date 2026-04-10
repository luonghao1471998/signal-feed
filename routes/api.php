<?php

/*
|--------------------------------------------------------------------------
| API routes (prefix /api) — SignalFeed
|--------------------------------------------------------------------------
| Domain endpoints are added in later roadmap tasks (1.4+, 1.10+, …).
*/

use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CurrentUserController;
use App\Http\Controllers\Api\SignalController;
use App\Http\Controllers\Api\SourceController;
use App\Http\Controllers\Api\UpdateCurrentUserController;
use Illuminate\Support\Facades\Route;

Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/sources', [SourceController::class, 'index']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/me', CurrentUserController::class);
    Route::patch('/me', UpdateCurrentUserController::class);
    Route::get('/signals', [SignalController::class, 'index']);
});
