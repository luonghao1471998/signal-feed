<?php

use App\Http\Controllers\Auth\TwitterAuthController;
use Illuminate\Support\Facades\Route;

require base_path('routes/admin.php');

Route::get('/auth/twitter', [TwitterAuthController::class, 'redirect'])
    ->name('auth.twitter');

Route::get('/auth/twitter/callback', [TwitterAuthController::class, 'callback'])
    ->name('auth.twitter.callback');

Route::post('/logout', [TwitterAuthController::class, 'logout'])
    ->middleware('auth')
    ->name('logout');

Route::view('/', 'app');

Route::view('/{any}', 'app')->where('any', '.*');
