<?php

/*
|--------------------------------------------------------------------------
| API routes (prefix /api) — SignalFeed
|--------------------------------------------------------------------------
| Domain endpoints are added in later roadmap tasks (1.4+, 1.10+, …).
*/

use App\Http\Controllers\Api\CategoryController;
use Illuminate\Support\Facades\Route;

Route::get('/categories', [CategoryController::class, 'index']);
