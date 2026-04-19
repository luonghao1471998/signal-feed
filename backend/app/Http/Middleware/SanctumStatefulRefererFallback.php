<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sanctum chỉ gắn session cho API khi Referer/Origin khớp stateful domains.
 * Một số trình duyệt không gửi Origin cho same-origin GET; Referer đôi khi trống
 * → cần fallback theo Host (first-party SPA cùng host với API).
 */
class SanctumStatefulRefererFallback
{
    public function handle(Request $request, Closure $next): Response
    {
        // Chỉ GET/HEAD: tránh bật pipeline CSRF Sanctum cho POST/PUT (tests & API JSON không gửi X-XSRF-TOKEN).
        if (! in_array($request->method(), ['GET', 'HEAD'], true)) {
            return $next($request);
        }

        if ($request->headers->get('Referer') || $request->headers->get('Origin')) {
            return $next($request);
        }

        $host = $request->getHttpHost();
        $stateful = array_map('trim', config('sanctum.stateful', []));

        foreach ($stateful as $domain) {
            if ($domain !== '' && strcasecmp($host, $domain) === 0) {
                $scheme = $request->getScheme();
                $request->headers->set('Referer', "{$scheme}://{$host}/");

                break;
            }
        }

        return $next($request);
    }
}
