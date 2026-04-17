<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPlanFeature
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $user = $request->user();

        if ($user === null) {
            return response()->json(['error' => 'PLAN_RESTRICTED'], 403);
        }

        $premiumFeatures = ['draft_copy', 'add_source'];
        $premiumPlans = ['pro', 'power'];

        if (in_array($feature, $premiumFeatures, true) && ! in_array($user->plan, $premiumPlans, true)) {
            return response()->json(['error' => 'PLAN_RESTRICTED'], 403);
        }

        return $next($request);
    }
}
