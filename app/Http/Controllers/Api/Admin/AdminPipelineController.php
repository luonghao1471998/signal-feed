<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminPipelineMetricsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminPipelineController extends Controller
{
    public function __construct(
        private readonly AdminPipelineMetricsService $metricsService
    ) {}

    /**
     * GET /api/admin/pipeline/status
     */
    public function status(Request $request): JsonResponse
    {
        $data = $this->metricsService->snapshotToday();

        $this->insertPipelineViewAudit($request);

        return response()->json([
            'data' => $data,
        ]);
    }

    private function insertPipelineViewAudit(Request $request): void
    {
        try {
            DB::table('audit_logs')->insert([
                'event_type' => 'admin_pipeline_view',
                'user_id' => $request->user()?->id,
                'resource_type' => null,
                'resource_id' => null,
                'changes' => json_encode([
                    'route' => 'GET /api/admin/pipeline/status',
                ]),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'tenant_id' => $request->user()?->tenant_id ?? 1,
                'created_at' => now()->utc(),
            ]);
        } catch (\Throwable) {
            // non-blocking
        }
    }
}
