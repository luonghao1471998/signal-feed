<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AuditLogService
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function log(
        string $eventType,
        ?int $userId,
        ?string $entityType,
        ?int $entityId,
        array $metadata = []
    ): void {
        $allowedEvents = [
            'oauth_login',
            'admin_source_action',
            'source.moderated',
            'source.moderation.notified',
            'admin_pipeline_view',
            'plan_change',
            'webhook_received',
            'subscription_cleanup',
            'digest.email.sent',
            'digest.email.failed',
            'digest.email.skipped_empty',
            'digest.email.skipped_tier_restriction',
            'digest.telegram.sent',
            'digest.telegram.failed',
            'digest.telegram.skipped_empty',
            'digest.telegram.skipped_tier_restriction',
            'telegram.connect.success',
            'telegram.connect.denied_plan',
            'telegram.connect.invalid_token',
        ];

        if (! in_array($eventType, $allowedEvents, true)) {
            Log::warning('audit_logs event type is not allowed', ['event_type' => $eventType]);

            return;
        }

        try {
            DB::table('audit_logs')->insert([
                'event_type' => $eventType,
                'user_id' => $userId,
                'resource_type' => $entityType,
                'resource_id' => $entityId,
                'changes' => json_encode($metadata),
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent(),
                'tenant_id' => 1,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('audit_logs insert failed', [
                'event_type' => $eventType,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
