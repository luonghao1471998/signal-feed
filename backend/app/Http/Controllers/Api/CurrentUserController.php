<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CurrentUserController extends Controller
{
    /**
     * GET /api/me — user hiện tại (session Sanctum hoặc Bearer token).
     */
    public function __invoke(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $plan = (string) $user->plan;
        if (! in_array($plan, ['free', 'pro', 'power'], true)) {
            $plan = 'free';
        }

        return response()->json([
            'id' => $user->id,
            'plan' => $plan,
            'x_username' => $user->x_username,
            'avatar_url' => $user->avatar_url,
            'my_categories' => $user->my_categories ?? [],
            'is_admin' => (bool) $user->is_admin,
        ]);
    }
}
