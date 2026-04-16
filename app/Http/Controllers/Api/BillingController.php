<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StripeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Stripe\Exception\ApiErrorException;

class BillingController extends Controller
{
    public function __construct(
        private readonly StripeService $stripeService
    ) {
    }

    public function checkout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan' => ['required', 'string', 'in:pro,power'],
        ]);

        $user = $request->user();
        $plan = $validated['plan'];

        if ($user->plan === $plan) {
            return response()->json([
                'error' => [
                    'code' => 'CONFLICT',
                    'message' => "You are already on the {$plan} plan.",
                ],
            ], 409);
        }

        try {
            $checkoutUrl = $this->stripeService->createCheckoutSession($user, $plan);

            return response()->json([
                'data' => [
                    'checkout_url' => $checkoutUrl,
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
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                ],
            ], 400);
        }
    }
}
