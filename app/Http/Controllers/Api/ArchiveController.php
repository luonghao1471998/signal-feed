<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Signal;
use App\Models\UserArchivedSignal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ArchiveController extends Controller
{
    /**
     * POST /api/signals/{id}/archive — save signal to personal archive (idempotent).
     */
    public function store(Request $request, int $id): JsonResponse
    {
        $signal = Signal::query()->find($id);

        if (! $signal) {
            return response()->json([
                'error' => [
                    'code' => 'NOT_FOUND',
                    'message' => 'Signal not found',
                ],
            ], 404);
        }

        $user = $request->user();
        $tenantId = (int) ($user->tenant_id ?? 1);

        $archived = UserArchivedSignal::query()->firstOrCreate(
            [
                'user_id' => $user->id,
                'signal_id' => $id,
            ],
            [
                'tenant_id' => $tenantId,
            ]
        );

        $wasNew = $archived->wasRecentlyCreated;
        if ($wasNew) {
            $archived->refresh();
        }

        $statusCode = $wasNew ? 201 : 200;

        return response()->json([
            'data' => [
                'signal_id' => $archived->signal_id,
                'archived_at' => $archived->created_at?->toIso8601String(),
            ],
        ], $statusCode);
    }

    /**
     * DELETE /api/signals/{id}/archive — remove from archive (idempotent).
     */
    public function destroy(Request $request, int $id): Response
    {
        UserArchivedSignal::query()
            ->where('user_id', $request->user()->id)
            ->where('signal_id', $id)
            ->delete();

        return response()->noContent();
    }
}
