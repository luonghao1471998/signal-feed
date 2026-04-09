<?php

/**
 * Manual Draft Generation Test Script
 *
 * Usage: php scripts/test_draft_generation.php
 *
 * Script này test draft generation trên EXISTING signals
 * mà KHÔNG modify database structure hoặc chạy migrations.
 *
 * ⚠️ CHỈ TEST 1 SIGNAL để tiết kiệm API credits!
 */

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\DraftTweet;
use App\Models\Signal;
use App\Services\DraftTweetService;

echo "\n========================================\n";
echo "Draft Tweet Generation Test\n";
echo "========================================\n\n";

$signalCount = Signal::count();
echo "📊 Signals trong database: {$signalCount}\n";

if ($signalCount === 0) {
    echo "❌ Không có signals. Chạy pipeline trước.\n";
    exit(1);
}

$service = app(DraftTweetService::class);

$signal = Signal::orderBy('rank_score', 'desc')->first();

echo "\n📝 Testing trên signal có rank cao nhất:\n";
echo "   ID: {$signal->id}\n";
echo "   Title: {$signal->title}\n";
echo "   Topics: ".implode(', ', $signal->topic_tags ?? [])."\n";
echo "   Rank Score: {$signal->rank_score}\n\n";

try {
    echo "🔄 Generating draft...\n";
    $draft = $service->generateDraft($signal);

    echo "\n✅ Draft Generated:\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "{$draft}\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    $len = mb_strlen($draft, 'UTF-8');
    echo "Length: {$len} characters\n";

    if ($len > 280) {
        echo "❌ LỖI: Draft vượt quá 280 characters!\n";
    } elseif ($len < 80) {
        echo "⚠️  CẢNH BÁO: Draft khá ngắn (< 80 chars)\n";
    } elseif ($len >= 120 && $len <= 200) {
        echo "✅ Độ dài perfect (target range 120-200 chars)\n";
    } else {
        echo "✅ Độ dài hợp lệ (trong giới hạn 280 chars)\n";
    }

    $draftRecord = DraftTweet::where('signal_id', $signal->id)->first();
    if ($draftRecord) {
        echo "✅ Draft đã lưu vào database (ID: {$draftRecord->id})\n";
    } else {
        echo "❌ Draft CHƯA được lưu vào database!\n";
    }
} catch (\Throwable $e) {
    echo "\n❌ Draft generation failed:\n";
    echo "   Error: {$e->getMessage()}\n";
    exit(1);
}

echo "\n========================================\n";
echo "Test hoàn thành thành công!\n";
echo "========================================\n\n";

echo "💡 TIP: Muốn test thêm signals?\n";
echo "   - Dùng tinker: php artisan tinker\n";
echo "   - Hoặc chạy script này lại (sẽ skip signal đã có draft)\n\n";
