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

        return [
            'signal_score' => $signalScore,
            'is_signal' => $signalScore >= 0.7,
        ];
    }
}
