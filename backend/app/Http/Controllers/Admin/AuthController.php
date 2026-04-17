<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        /** @var Admin|null $admin */
        $admin = Admin::query()->where('email', $validated['email'])->first();

        if ($admin === null || ! $admin->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Incorrect email or password'],
            ]);
        }

        if (! Hash::check($validated['password'], $admin->password)) {
            throw ValidationException::withMessages([
                'email' => ['Incorrect email or password'],
            ]);
        }

        $remember = (bool) ($validated['remember'] ?? false);

        Auth::guard('admin')->login($admin, $remember);
        $request->session()->regenerate();

        $admin->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'data' => $this->adminPayload($admin),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('admin')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'OK']);
    }

    public function me(Request $request): JsonResponse
    {
        $admin = Auth::guard('admin')->user();
        if ($admin === null) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'data' => $this->adminPayload($admin),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function adminPayload(Admin $admin): array
    {
        return [
            'id' => $admin->id,
            'name' => $admin->name,
            'email' => $admin->email,
            'role' => $admin->role,
        ];
    }
}
