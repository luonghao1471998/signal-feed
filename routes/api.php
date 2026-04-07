<?php

/*
|--------------------------------------------------------------------------
| API routes (prefix /api) — SignalFeed
|--------------------------------------------------------------------------
| Domain endpoints are added in later roadmap tasks (1.4+, 1.10+, …).
*/

use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\SourceController;
use Illuminate\Support\Facades\Route;

Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/sources', [SourceController::class, 'index']);
