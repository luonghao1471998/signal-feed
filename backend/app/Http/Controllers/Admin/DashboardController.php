<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    /**
     * GET /admin/api/dashboard
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => [
                'message' => 'Coming soon',
            ],
        ]);
    }
}
