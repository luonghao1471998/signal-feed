<?php

namespace App\Http\Controllers\Api;

use App\Events\DraftCopied;
use App\Http\Controllers\Controller;
use App\Models\Signal;
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

        if (!in_array($plan, ['pro', 'power'], true)) {
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
        // x.com/intent/post matches the current compose flow better than /intent/tweet (prefill race on X SPA).
        $twitterIntentUrl = 'https://x.com/intent/post?text=' . rawurlencode($text);

        event(new DraftCopied($user, $signal, $draft));

        return response()->json([
            'data' => [
                'twitter_intent_url' => $twitterIntentUrl,
            ],
        ]);
    }
}