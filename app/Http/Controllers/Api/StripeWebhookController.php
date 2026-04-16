<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StripeWebhookService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    public function __construct(
        private readonly StripeWebhookService $webhookService
    ) {
    }

    public function handle(Request $request): Response|\Illuminate\Http\JsonResponse
    {
        $webhookSecret = config('services.stripe.webhook_secret');
        if ($webhookSecret === null || $webhookSecret === '') {
            Log::error('Stripe webhook: STRIPE_WEBHOOK_SECRET is not configured');

            return response()->json([
                'error' => [
                    'code' => 'CONFIG_ERROR',
                    'message' => 'Webhook secret is not configured.',
                ],
            ], 500);
        }

        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        if ($sigHeader === null || $sigHeader === '') {
            return response()->json([
                'error' => [
                    'code' => 'INVALID_SIGNATURE',
                    'message' => 'Missing Stripe-Signature header.',
                ],
            ], 401);
        }

        try {
            $event = Webhook::constructEvent($payload, $sigHeader, $webhookSecret);
        } catch (SignatureVerificationException $e) {
            return response()->json([
                'error' => [
                    'code' => 'INVALID_SIGNATURE',
                    'message' => $e->getMessage(),
                ],
            ], 401);
        } catch (\UnexpectedValueException $e) {
            return response()->json([
                'error' => [
                    'code' => 'INVALID_PAYLOAD',
                    'message' => $e->getMessage(),
                ],
            ], 400);
        }

        if (DB::table('processed_stripe_events')->where('event_id', $event->id)->exists()) {
            return response()->json([
                'data' => [
                    'received' => true,
                    'duplicate' => true,
                ],
            ], 200);
        }

        try {
            DB::transaction(function () use ($event): void {
                $this->webhookService->processStripeEvent($event);
                DB::table('processed_stripe_events')->insert([
                    'event_id' => $event->id,
                    'event_type' => $event->type,
                    'processed_at' => now(),
                    'created_at' => now(),
                ]);
            });
        } catch (\Illuminate\Database\QueryException $e) {
            if ($this->isDuplicateKeyException($e)) {
                return response()->json([
                    'data' => [
                        'received' => true,
                        'duplicate' => true,
                    ],
                ], 200);
            }

            Log::error('Stripe webhook: database error', [
                'message' => $e->getMessage(),
                'event_id' => $event->id ?? null,
            ]);

            return response()->json([
                'error' => [
                    'code' => 'PROCESSING_ERROR',
                    'message' => 'Webhook processing failed.',
                ],
            ], 500);
        } catch (\Throwable $e) {
            Log::error('Stripe webhook: processing failed', [
                'message' => $e->getMessage(),
                'event_id' => $event->id ?? null,
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => [
                    'code' => 'PROCESSING_ERROR',
                    'message' => 'Webhook processing failed.',
                ],
            ], 500);
        }

        return response()->json([
            'data' => [
                'received' => true,
            ],
        ], 200);
    }

    private function isDuplicateKeyException(\Illuminate\Database\QueryException $e): bool
    {
        $sqlState = $e->errorInfo[0] ?? '';
        if ($sqlState === '23505') {
            return true;
        }

        return str_contains(strtolower($e->getMessage()), 'duplicate key')
            || str_contains(strtolower($e->getMessage()), 'unique constraint');
    }
}
