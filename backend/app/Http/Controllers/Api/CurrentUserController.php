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

        $myCategories = array_values(array_filter(
            array_map(
                static fn ($id): int => (int) $id,
                is_array($user->my_categories) ? $user->my_categories : []
            ),
            static fn (int $id): bool => $id > 0
        ));

        return response()->json([
            'id' => $user->id,
            'plan' => $plan,
            'x_username' => $user->x_username,
            'avatar_url' => $user->avatar_url,
            'my_categories' => $myCategories,
            'is_admin' => (bool) $user->is_admin,
        ]);
    }
}
