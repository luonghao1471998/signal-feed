<?php

namespace App\Services;

/**
 * Deterministic classify stub — không gọi Anthropic (tiết kiệm credits).
 *
 * Bật qua config app.mock_llm / env MOCK_LLM=true.
 */
class FakeLLMClient
{
    /**
     * @return array{signal_score: float, is_signal: bool}
     */
    public function classify(string $tweetText): array
    {
        $textLength = strlen($tweetText);
        $hasLink = str_contains($tweetText, 'http');
        $hasMention = str_contains($tweetText, '@');

        $baseScore = ($textLength % 100) / 100;

        if ($hasLink) {
            $baseScore += 0.2;
        }
        if ($hasMention) {
            $baseScore += 0.1;
        }

        $signalScore = min(1.0, max(0.0, $baseScore));
        $signalScore = round($signalScore, 2);

        $threshold = (float) config('signalfeed.signal_threshold', 0.6);

        return [
            'signal_score' => $signalScore,
            'is_signal' => $signalScore >= $threshold,
        ];
    }

    /**
     * Trả về JSON string (giống assistant text từ Claude) — deterministic, không gọi API.
     *
     * @throws \JsonException
     */
    public function cluster(string $prompt): string
    {
        preg_match_all('/"id"\s*:\s*(\d+)/', $prompt, $matches);
        /** @var list<int> $ids */
        $ids = array_map('intval', $matches[1] ?? []);
        $ids = array_values(array_unique($ids));

        if (count($ids) < 2) {
            return json_encode(['clusters' => [], 'unclustered' => $ids], JSON_THROW_ON_ERROR);
        }

        $clusters = [];
        $remaining = $ids;
        $topicN = 1;

        while (count($remaining) >= 2) {
            $pair = array_slice($remaining, 0, 2);
            $remaining = array_slice($remaining, 2);
            $clusters[] = [
                'tweet_ids' => $pair,
                'topic' => 'Mock topic '.$topicN,
            ];
            $topicN++;
        }

        return json_encode([
            'clusters' => $clusters,
            'unclustered' => $remaining,
        ], JSON_THROW_ON_ERROR);
    }

    /**
     * JSON assistant text cho summarize — deterministic, không gọi API.
     *
     * @throws \JsonException
     */
    public function summarize(string $prompt): string
    {
        $topic = 'Signal';
        if (preg_match('/\*\*Cluster Topic:\*\*\s*(.+)/u', $prompt, $m)) {
            $topic = trim($m[1]);
        }

        $words = [];
        for ($i = 0; $i < 60; $i++) {
            $words[] = 'word'.$i;
        }
        $summary = ucfirst($topic).'. '.implode(' ', $words).'.';

        $payload = [
            'title' => 'Mock Title About '.$topic,
            'summary' => $summary,
            'topic_tags' => ['Tech', 'Mock'],
        ];

        return json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    }

    /**
     * JSON assistant text cho draft tweet — deterministic, không gọi API.
     *
     * @throws \JsonException
     */
    public function generateDraft(string $prompt): string
    {
        $title = 'Signal';
        if (preg_match('/\*\*Title:\*\*\s*(.+)/u', $prompt, $m)) {
            $title = trim($m[1]);
        }

        $body = $title;
        if (mb_strlen($body) < 80) {
            $body .= ' Teams watch this for product, GTM, and competitive context.';
        }
        $body = mb_substr($body, 0, 200, 'UTF-8');

        return json_encode(['draft' => $body], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    }
}
