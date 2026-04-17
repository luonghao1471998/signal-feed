<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminPipelineMetricsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PipelineController extends Controller
{
    public function __construct(
        private readonly AdminPipelineMetricsService $metricsService
    ) {
    }

    /**
     * GET /admin/api/pipeline/status
     */
    public function status(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        $data = $this->metricsService->snapshotForRange(
            $validated['start_date'] ?? null,
            $validated['end_date'] ?? null
        );

        if (! empty($validated['start_date']) || ! empty($validated['end_date'])) {
            $start = $validated['start_date'] ?? now()->toDateString();
            $end = $validated['end_date'] ?? now()->toDateString();
            $data['range'] = [
                'start_date' => $start,
                'end_date' => $end,
            ];
        }

        $admin = Auth::guard('admin')->user();
        if ($admin !== null) {
            $admin->logAction('admin_pipeline_view', null, null, [
                'route' => 'GET /admin/api/pipeline/status',
            ]);
        }

        return response()->json([
            'data' => $data,
        ]);
    }
}
