<?php

use App\Http\Controllers\Admin\AdminAccountController;
use App\Http\Controllers\Admin\CategoryManagementController;
use App\Http\Controllers\Admin\DigestManagementController;
use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\PipelineController;
use App\Http\Controllers\Admin\SignalManagementController;
use App\Http\Controllers\Admin\SourceManagementController;
use App\Http\Controllers\Admin\SourceModerationController;
use App\Http\Controllers\Admin\TweetManagementController;
use App\Http\Controllers\Admin\UserManagementController;
use Illuminate\Support\Facades\Route;

Route::prefix('admin')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login'])->name('admin.login');

    Route::middleware('auth:admin')->group(function (): void {
        Route::post('/logout', [AuthController::class, 'logout'])->name('admin.logout');
        Route::get('/api/me', [AuthController::class, 'me']);

        Route::get('/api/dashboard', [DashboardController::class, 'index']);

        Route::get('/api/digests', [DigestManagementController::class, 'index']);
        Route::get('/api/digests/{id}', [DigestManagementController::class, 'show'])->whereNumber('id');
        Route::post('/api/digests', [DigestManagementController::class, 'store']);
        Route::patch('/api/digests/{id}', [DigestManagementController::class, 'update'])->whereNumber('id');
        Route::delete('/api/digests/{id}', [DigestManagementController::class, 'destroy'])->whereNumber('id');

        Route::get('/api/signals', [SignalManagementController::class, 'index']);
        Route::get('/api/signals/{id}', [SignalManagementController::class, 'show'])->whereNumber('id');
        Route::post('/api/signals', [SignalManagementController::class, 'store']);
        Route::patch('/api/signals/{id}', [SignalManagementController::class, 'update'])->whereNumber('id');
        Route::delete('/api/signals/{id}', [SignalManagementController::class, 'destroy'])->whereNumber('id');
        Route::patch('/api/signals/{id}/flag', [SignalManagementController::class, 'flag'])->whereNumber('id');

        Route::get('/api/tweets', [TweetManagementController::class, 'index']);
        Route::get('/api/tweets/{id}', [TweetManagementController::class, 'show'])->whereNumber('id');
        Route::post('/api/tweets', [TweetManagementController::class, 'store']);
        Route::patch('/api/tweets/{id}', [TweetManagementController::class, 'update'])->whereNumber('id');
        Route::delete('/api/tweets/{id}', [TweetManagementController::class, 'destroy'])->whereNumber('id');

        Route::get('/api/sources', [SourceManagementController::class, 'index']);
        Route::get('/api/sources/{id}', [SourceManagementController::class, 'show'])->whereNumber('id');
        Route::post('/api/sources', [SourceManagementController::class, 'store']);
        Route::patch('/api/sources/{id}', [SourceManagementController::class, 'update'])->whereNumber('id');
        Route::delete('/api/sources/{id}', [SourceManagementController::class, 'destroy'])->whereNumber('id');

        Route::get('/api/source-moderation', [SourceModerationController::class, 'index']);
        Route::patch('/api/source-moderation/{id}', [SourceModerationController::class, 'moderate'])->whereNumber('id');

        Route::get('/api/categories', [CategoryManagementController::class, 'index']);
        Route::get('/api/categories/{id}', [CategoryManagementController::class, 'show'])->whereNumber('id');
        Route::post('/api/categories', [CategoryManagementController::class, 'store']);
        Route::patch('/api/categories/{id}', [CategoryManagementController::class, 'update'])->whereNumber('id');
        Route::delete('/api/categories/{id}', [CategoryManagementController::class, 'destroy'])->whereNumber('id');

        Route::get('/api/pipeline/status', [PipelineController::class, 'status']);

        Route::get('/api/users', [UserManagementController::class, 'index']);
        Route::get('/api/users/{id}', [UserManagementController::class, 'show'])->whereNumber('id');
        Route::patch('/api/users/{id}', [UserManagementController::class, 'update'])->whereNumber('id');
        Route::patch('/api/users/{id}/suspend', [UserManagementController::class, 'suspend'])->whereNumber('id');
        Route::patch('/api/users/{id}/activate', [UserManagementController::class, 'activate'])->whereNumber('id');

        Route::get('/api/admins', [AdminAccountController::class, 'index']);
        Route::get('/api/admins/{id}', [AdminAccountController::class, 'show'])->whereNumber('id');
        Route::post('/api/admins', [AdminAccountController::class, 'store']);
        Route::patch('/api/admins/{id}', [AdminAccountController::class, 'update'])->whereNumber('id');
        Route::delete('/api/admins/{id}', [AdminAccountController::class, 'destroy'])->whereNumber('id');
    });
});
