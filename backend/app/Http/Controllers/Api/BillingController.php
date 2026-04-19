<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillingInvoice;
use App\Services\StripeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use InvalidArgumentException;
use RuntimeException;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

class BillingController extends Controller
{
    public function __construct(
        private readonly StripeService $stripeService,
    ) {}

    public function checkout(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plan' => ['required', 'string', 'in:pro,power'],
        ]);
        if ($validator->fails()) {
            return response()->json([
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => (string) $validator->errors()->first('plan'),
                ],
            ], 400);
        }

        $validated = $validator->validated();
        $user = $request->user();
        $plan = $validated['plan'];
        $currentPlan = (string) ($user->plan ?? 'free');

        if ($currentPlan === $plan) {
            return response()->json([
                'error' => [
                    'code' => 'CONFLICT',
                    'message' => "You are already on the {$plan} plan.",
                ],
            ], 409);
        }

        if ($currentPlan === 'power' && $plan === 'pro') {
            return response()->json([
                'error' => [
                    'code' => 'CONFLICT',
                    'message' => 'Downgrading from Power to Pro is not available via checkout. Contact support if you need help.',
                ],
            ], 409);
        }

        if ($currentPlan === 'power') {
            return response()->json([
                'error' => [
                    'code' => 'CONFLICT',
                    'message' => 'You are already on the highest plan. Use Renew to extend your billing period or contact support.',
                ],
            ], 409);
        }

        // Pro → Power: Setup Checkout (mode=setup) để user chọn/xác nhận thẻ + SCA.
        // Webhook checkout.session.completed sẽ gọi subscriptions.update + proration sau khi setup hoàn tất.
        if ($currentPlan === 'pro' && $plan === 'power') {
            try {
                $this->stripeService->assertMayCheckoutUpgradeProToPower($user);
                $checkoutUrl = $this->stripeService->createSetupCheckoutForUpgrade($user->fresh(), 'power');

                return response()->json([
                    'data' => [
                        'checkout_url' => $checkoutUrl,
                        'upgraded' => false,
                    ],
                ]);
            } catch (ApiErrorException $e) {
                Log::error('Stripe Pro→Power setup checkout failed', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                    'code' => $e->getStripeCode(),
                ]);

                return response()->json([
                    'error' => [
                        'code' => 'STRIPE_ERROR',
                        'message' => 'Payment service could not start upgrade. Please try again.',
                    ],
                ], 502);
            } catch (InvalidArgumentException $e) {
                return response()->json([
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => $e->getMessage(),
                    ],
                ], 400);
            } catch (RuntimeException $e) {
                Log::error('Stripe configuration error (Pro→Power setup checkout)', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);

                return response()->json([
                    'error' => [
                        'code' => 'CONFIG_ERROR',
                        'message' => 'Billing service is not configured correctly.',
                    ],
                ], 500);
            } catch (\Throwable $e) {
                Log::error('Unexpected Pro→Power setup checkout error', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);

                return response()->json([
                    'error' => [
                        'code' => 'INTERNAL_ERROR',
                        'message' => 'Unexpected billing error. Please try again.',
                    ],
                ], 500);
            }
        }

        try {
            // Free → Pro hoặc Free → Power: Checkout Session mới (chặn nếu đã có subscription active).
            $this->stripeService->assertMayCreateCheckoutSubscription($user);
            $checkoutUrl = $this->stripeService->createCheckoutSession($user, $plan);

            return response()->json([
                'data' => [
                    'checkout_url' => $checkoutUrl,
                    'upgraded' => false,
                ],
            ]);
        } catch (ApiErrorException $e) {
            Log::error('Stripe Checkout Session creation failed', [
                'user_id' => $user->id,
                'plan' => $plan,
                'error' => $e->getMessage(),
                'code' => $e->getStripeCode(),
            ]);

            return response()->json([
                'error' => [
                    'code' => 'STRIPE_ERROR',
                    'message' => 'Payment service is temporarily unavailable. Please try again.',
                ],
            ], 500);
        } catch (RuntimeException $e) {
            Log::error('Stripe Checkout configuration/runtime error', [
                'user_id' => $user->id,
                'plan' => $plan,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => [
                    'code' => 'CONFIG_ERROR',
                    'message' => 'Billing service is not configured correctly.',
                ],
            ], 500);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                ],
            ], 400);
        } catch (\Throwable $e) {
            Log::error('Unexpected checkout error', [
                'user_id' => $user->id,
                'plan' => $plan,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'Unexpected billing error. Please try again.',
                ],
            ], 500);
        }
    }

    /**
     * POST /api/billing/portal — tạo Stripe Billing Portal session để người dùng quản lý thẻ thanh toán.
     */
    public function portal(Request $request): JsonResponse
    {
        $user = $request->user();

        if (empty($user->stripe_customer_id)) {
            return response()->json([
                'error' => [
                    'code' => 'NO_STRIPE_CUSTOMER',
                    'message' => 'No billing account found. Please subscribe to a plan first.',
                ],
            ], 400);
        }

        try {
            $stripe = new StripeClient(config('services.stripe.secret'));
            $returnUrl = config('app.frontend_url').'/settings?tab=billing';

            $portalSession = $stripe->billingPortal->sessions->create([
                'customer' => $user->stripe_customer_id,
                'return_url' => $returnUrl,
            ]);

            return response()->json([
                'data' => [
                    'portal_url' => $portalSession->url,
                ],
            ]);
        } catch (ApiErrorException $e) {
            Log::error('Stripe Billing Portal session creation failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'code' => $e->getStripeCode(),
            ]);

            return response()->json([
                'error' => [
                    'code' => 'STRIPE_ERROR',
                    'message' => 'Could not open billing portal. Please try again.',
                ],
            ], 500);
        } catch (\Throwable $e) {
            Log::error('Billing Portal unexpected error', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'Unexpected error. Please try again.',
                ],
            ], 500);
        }
    }

    /**
     * GET /api/billing/history — lịch sử hóa đơn lưu từ Stripe webhook (bảng billing_invoices).
     */
    public function history(Request $request): JsonResponse
    {
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 15), 1), 50);
        $page = max((int) $request->query('page', 1), 1);

        $paginator = BillingInvoice::query()
            ->where('user_id', $user->id)
            ->orderByDesc('stripe_created_at')
            ->orderByDesc('id')
            ->paginate(perPage: $perPage, page: $page);

        $data = $paginator->getCollection()->map(fn (BillingInvoice $row): array => $this->formatBillingInvoiceRow($row))->values()->all();

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatBillingInvoiceRow(BillingInvoice $row): array
    {
        $cents = $row->amount_paid > 0 ? $row->amount_paid : $row->amount_due;
        $amountFormatted = $this->formatMoneyCents($cents, $row->currency);

        $displayDate = $row->paid_at ?? $row->stripe_created_at ?? $row->created_at;

        return [
            'id' => $row->id,
            'date' => $displayDate?->toIso8601String(),
            'description' => $row->description ?? '',
            'amount' => $amountFormatted,
            'amount_cents' => $cents,
            'currency' => $row->currency,
            'status' => $row->status,
            'invoice_url' => $row->hosted_invoice_url,
        ];
    }

    private function formatMoneyCents(int $cents, string $currency): string
    {
        $code = strtoupper($currency);

        return number_format($cents / 100, 2).' '.$code;
    }
}
