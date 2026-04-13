<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Signal;
use App\Models\UserInteraction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DraftController extends Controller
{
    /**
     * POST /api/signals/{id}/draft/copy — Twitter Web Intent + log copy_draft (SPEC-api).
     */
    public function copy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $plan = (string) $user->plan;

        if (! in_array($plan, ['pro', 'power'], true)) {
            return response()->json([
                'message' => 'Draft access is available for Pro/Power users only. Upgrade to access this feature.',
            ], 403);
        }

        $signal = Signal::query()->with('draft')->find($id);

        if ($signal === null) {
            return response()->json([
                'message' => 'Signal not found',
            ], 404);
        }

        $draft = $signal->draft;
        if ($draft === null) {
            return response()->json([
                'message' => 'Draft not found for this signal',
            ], 404);
        }

        $text = $draft->text;
        $twitterIntentUrl = 'https://twitter.com/intent/tweet?text='.rawurlencode($text);

        UserInteraction::query()->create([
            'user_id' => $user->id,
            'signal_id' => $signal->id,
            'action' => 'copy_draft',
            'metadata' => ['draft_id' => $draft->id],
            'tenant_id' => $user->tenant_id ?? 1,
            'created_at' => now()->utc(),
        ]);

        return response()->json([
            'data' => [
                'twitter_intent_url' => $twitterIntentUrl,
            ],
        ]);
    }
}
