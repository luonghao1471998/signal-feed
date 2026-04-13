<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateCurrentUserRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class UpdateCurrentUserController extends Controller
{
    public function __invoke(UpdateCurrentUserRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $validated = $request->validated();

        $user->my_categories = $validated['my_categories'];
        $user->save();

        return $this->userJson($user);
    }

    private function userJson(User $user): JsonResponse
    {
        $plan = (string) $user->plan;
        if (! in_array($plan, ['free', 'pro', 'power'], true)) {
            $plan = 'free';
        }

        return response()->json([
            'id' => $user->id,
            'plan' => $plan,
            'x_username' => $user->x_username,
            'my_categories' => $user->my_categories ?? [],
            'is_admin' => (bool) $user->is_admin,
        ]);
    }
}
