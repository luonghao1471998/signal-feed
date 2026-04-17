<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminAccountController extends Controller
{
    public function show(int $id): JsonResponse
    {
        $this->authorizeSuperAdmin();
        $admin = Admin::query()->findOrFail($id);

        return response()->json([
            'data' => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
                'role' => $admin->role,
                'is_active' => $admin->is_active,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin();

        $validated = $request->validate([
            'email' => ['nullable', 'string'],
            'role' => ['nullable', Rule::in(['super_admin', 'moderator'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Admin::query();
        if (! empty($validated['email'])) {
            $query->where('email', 'ILIKE', '%' . $validated['email'] . '%');
        }
        if (! empty($validated['role'])) {
            $query->where('role', $validated['role']);
        }

        $admins = $query
            ->orderByDesc('created_at')
            ->paginate((int) ($validated['per_page'] ?? 20));

        return response()->json([
            'data' => $admins->getCollection()->map(fn (Admin $admin): array => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
                'role' => $admin->role,
                'is_active' => $admin->is_active,
                'created_at' => $admin->created_at?->format('Y-m-d H:i:s'),
            ]),
            'meta' => [
                'current_page' => $admins->currentPage(),
                'last_page' => $admins->lastPage(),
                'per_page' => $admins->perPage(),
                'total' => $admins->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:admins,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(['super_admin', 'moderator'])],
        ]);

        $admin = Admin::query()->create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'role' => $validated['role'],
            'is_active' => true,
        ]);

        return response()->json(['data' => ['id' => $admin->id]], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->authorizeSuperAdmin();

        $admin = Admin::query()->findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('admins', 'email')->ignore($admin->id)],
            'password' => ['sometimes', 'string', 'min:8'],
            'role' => ['sometimes', Rule::in(['super_admin', 'moderator'])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['password'])) {
            $admin->password = $validated['password'];
            unset($validated['password']);
        }

        $admin->fill($validated);
        $admin->save();

        return response()->json(['message' => 'OK']);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorizeSuperAdmin();

        $actor = auth('admin')->user();
        if ($actor !== null && $actor->id === $id) {
            return response()->json(['message' => 'Cannot delete own account'], 400);
        }

        Admin::query()->whereKey($id)->delete();

        return response()->json(['message' => 'OK']);
    }

    private function authorizeSuperAdmin(): void
    {
        $admin = auth('admin')->user();
        if ($admin === null || $admin->role !== 'super_admin') {
            abort(403, 'Super admin only');
        }
    }
}
