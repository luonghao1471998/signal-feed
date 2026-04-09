# Draft Generation Testing với Tinker

⚠️ **LƯU Ý:** Chỉ test với 1-2 signals để tiết kiệm API credits!

---

## Quick Test (1 Signal - RECOMMENDED)

```bash
php artisan tinker
```

```php
// Lấy 1 signal
$signal = \App\Models\Signal::first();

// Lấy service
$service = app(\App\Services\DraftTweetService::class);

// Generate draft
$draft = $service->generateDraft($signal);

// Display kết quả
echo "Draft: {$draft}\n";
echo "Length: " . mb_strlen($draft, 'UTF-8') . " chars\n";

// Verify trong database
$draftRecord = \App\Models\DraftTweet::where('signal_id', $signal->id)->first();
echo "Saved: " . ($draftRecord ? 'Yes' : 'No') . "\n";
```

---

## ⚠️ CẢNH BÁO: Test Toàn Bộ Signals (TỐN CREDITS!)

**KHÔNG NÊN chạy code này trừ khi mày có nhiều credits:**

```php
// ❌ Code này sẽ consume nhiều API calls!
// ❌ CHỈ chạy khi đã có budget đủ!

$signals = \App\Models\Signal::all();  // 7 signals = 7 API calls
$service = app(\App\Services\DraftTweetService::class);

$results = $service->generateDraftsForSignals($signals);

echo "Success: {$results['success']}\n";
echo "Failed: {$results['failed']}\n";
```

**Thay vào đó, test từng signal một:**

```php
// ✅ Test 1 signal
$signal = \App\Models\Signal::find(3);
$draft = app(\App\Services\DraftTweetService::class)->generateDraft($signal);
echo $draft;
```

---

## Verify Draft Quality

```php
// Lấy tất cả drafts với signal info
$drafts = \App\Models\DraftTweet::with('signal')
    ->get()
    ->map(function($draft) {
        return [
            'signal_id' => $draft->signal_id,
            'title' => substr($draft->signal->title, 0, 40),
            'topics' => implode(', ', $draft->signal->topic_tags ?? []),
            'draft' => $draft->text,
            'length' => mb_strlen($draft->text, 'UTF-8'),
        ];
    });

// Display table
$drafts->each(function($d) {
    echo "\n" . str_repeat('=', 60) . "\n";
    echo "Signal: {$d['title']}...\n";
    echo "Topics: {$d['topics']}\n";
    echo "Draft ({$d['length']} chars):\n";
    echo "{$d['draft']}\n";
});
```

---

## Check Character Limits

```php
// Verify tất cả drafts ≤280 chars
$violations = \App\Models\DraftTweet::all()->filter(function($draft) {
    return mb_strlen($draft->text, 'UTF-8') > 280;
});

if ($violations->count() === 0) {
    echo "✅ Tất cả drafts trong giới hạn 280 chars\n";
} else {
    echo "❌ {$violations->count()} drafts vượt quá giới hạn!\n";
    $violations->each(function($draft) {
        echo "  Signal ID {$draft->signal_id}: " . mb_strlen($draft->text, 'UTF-8') . " chars\n";
    });
}
```

---

## Test Category-Specific Tone

```php
// Group theo primary category
$categories = ['Funding', 'Product Launch', 'AI', 'Research'];

foreach ($categories as $category) {
    $signals = \App\Models\Signal::whereJsonContains('topic_tags', $category)
        ->with('draft')
        ->get();

    echo "\n=== {$category} Signals ===\n";

    $signals->each(function($signal) {
        if ($signal->draft) {
            echo "Draft: {$signal->draft->text}\n\n";
        }
    });
}
```

---

## Re-generate Single Draft (Force)

```php
// Xóa draft hiện tại
$signal = \App\Models\Signal::find(3);
$signal->draft()->delete();

// Generate draft mới
$service = app(\App\Services\DraftTweetService::class);
$draft = $service->generateDraft($signal);

echo "Draft mới: {$draft}\n";
```
