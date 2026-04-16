<?php

/**
 * Manual Stripe webhook verification (Task 3.1.2).
 * Không gọi Stripe API — chỉ giả lập JSON event + chữ ký HMAC theo STRIPE_WEBHOOK_SECRET.
 *
 * Usage:
 *   php test_stripe_webhook.php sub_updated <user_id>
 *   php test_stripe_webhook.php sub_deleted <user_id>
 *   php test_stripe_webhook.php invoice_failed <user_id>
 *
 * Trước khi chạy: đặt STRIPE_WEBHOOK_SECRET trong .env (cùng secret dùng khi verify thật).
 * Script tự gán dữ liệu stripe_* trên user khi cần (sub_updated / sub_deleted / invoice_failed).
 */

declare(strict_types=1);

use App\Models\User;
use Illuminate\Http\Request;

$basePath = __DIR__;
require $basePath . '/vendor/autoload.php';
$app = require_once $basePath . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$scenario = $argv[1] ?? '';
$userId = isset($argv[2]) ? (int) $argv[2] : 1;

if (! in_array($scenario, ['sub_updated', 'sub_deleted', 'invoice_failed'], true)) {
    fwrite(STDERR, "Usage: php test_stripe_webhook.php {sub_updated|sub_deleted|invoice_failed} [user_id]\n");

    exit(1);
}

$secret = (string) config('services.stripe.webhook_secret');
if ($secret === '') {
    fwrite(STDERR, "STRIPE_WEBHOOK_SECRET is empty — set in .env first.\n");

    exit(1);
}

$user = User::query()->find($userId);
if ($user === null) {
    fwrite(STDERR, "User id {$userId} not found.\n");

    exit(1);
}

$proPriceId = (string) config('services.stripe.pro_price_id');
$powerPriceId = (string) config('services.stripe.power_price_id');
if ($scenario === 'sub_updated' && $proPriceId === '' && $powerPriceId === '') {
    fwrite(STDERR, "sub_updated: set STRIPE_PRO_PRICE_ID or STRIPE_POWER_PRICE_ID in .env for plan mapping.\n");

    exit(1);
}
$priceForTest = $proPriceId !== '' ? $proPriceId : $powerPriceId;

$eventId = 'evt_manual_' . bin2hex(random_bytes(8));
$subId = 'sub_manual_' . bin2hex(random_bytes(4));
$cusId = 'cus_manual_' . bin2hex(random_bytes(4));

$payloadArray = match ($scenario) {
    'sub_updated' => (function () use ($user, $subId, $cusId, $priceForTest, $eventId): array {
        $user->stripe_customer_id = $cusId;
        $user->stripe_subscription_id = $subId;
        $user->plan = 'free';
        $user->save();

        return [
            'id' => $eventId,
            'object' => 'event',
            'type' => 'customer.subscription.updated',
            'data' => [
                'object' => [
                    'id' => $subId,
                    'object' => 'subscription',
                    'customer' => $cusId,
                    'status' => 'active',
                    'items' => [
                        'object' => 'list',
                        'data' => [
                            [
                                'id' => 'si_test',
                                'price' => [
                                    'id' => $priceForTest,
                                    'object' => 'price',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];
    })(),
    'sub_deleted' => (function () use ($user, $subId, $cusId, $eventId): array {
        $user->stripe_customer_id = $cusId;
        $user->stripe_subscription_id = $subId;
        $user->plan = 'pro';
        $user->save();

        return [
            'id' => $eventId,
            'object' => 'event',
            'type' => 'customer.subscription.deleted',
            'data' => [
                'object' => [
                    'id' => $subId,
                    'object' => 'subscription',
                    'customer' => $cusId,
                    'status' => 'canceled',
                ],
            ],
        ];
    })(),
    'invoice_failed' => (function () use ($user, $cusId, $eventId): array {
        $user->stripe_customer_id = $cusId;
        $user->plan = 'pro';
        $user->save();

        return [
            'id' => $eventId,
            'object' => 'event',
            'type' => 'invoice.payment_failed',
            'data' => [
                'object' => [
                    'id' => 'in_test_' . bin2hex(random_bytes(4)),
                    'object' => 'invoice',
                    'customer' => $cusId,
                    'attempt_count' => 3,
                ],
            ],
        ];
    })(),
};

$payload = json_encode($payloadArray, JSON_UNESCAPED_SLASHES);
if ($payload === false) {
    fwrite(STDERR, "json_encode failed\n");

    exit(1);
}

$t = time();
$signedPayload = $t . '.' . $payload;
$sig = hash_hmac('sha256', $signedPayload, $secret);
$stripeSignature = 't=' . $t . ',v1=' . $sig;

$request = Request::create(
    '/api/webhooks/stripe',
    'POST',
    [],
    [],
    [],
    [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_ACCEPT' => 'application/json',
        'HTTP_STRIPE_SIGNATURE' => $stripeSignature,
    ],
    $payload
);

$response = $kernel->handle($request);
$status = $response->getStatusCode();
$body = $response->getContent();

echo "Scenario: {$scenario}\n";
echo "User id: {$userId}\n";
echo "Event id: {$eventId}\n";
echo "HTTP {$status}\n";
echo $body . "\n";

$kernel->terminate($request, $response);
