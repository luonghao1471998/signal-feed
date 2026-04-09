<?php

namespace App\Services;

use App\Integrations\LLMClient;
use App\Models\Tweet;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class SignalSummarizerService
{
    private const LLM_ATTEMPTS = 3;

    private const STRICT_JSON_SUFFIX = <<<'TXT'


IMPORTANT: Reply with a single JSON object only. No markdown fences, no commentary. Keys: "title", "summary", "topic_tags" (array of strings).
TXT;

    private string $promptTemplate;

    public function __construct(
        private readonly LLMClient $llmClient,
        private readonly FakeLLMClient $fakeLlmClient
    ) {
        $path = base_path((string) config('anthropic.summarize_prompt_path', 'docs/prompts/v1/summarize.md'));
        if (! File::isFile($path)) {
            throw new \RuntimeException("Summarize prompt file missing: {$path}");
        }
        $this->promptTemplate = File::get($path);
    }

    /**
     * @param  array{cluster_id: string, tweet_ids: list<int>, topic: string}  $cluster
     * @param  Collection<int, Tweet>  $allTweets
     * @return array{cluster_id: string, title: string, summary: string, topic_tags: list<string>, source_count: int, tweet_ids: list<int>}|null
     */
    public function summarizeCluster(array $cluster, Collection $allTweets): ?array
    {
        $clusterId = (string) ($cluster['cluster_id'] ?? '');

        try {
            /** @var list<int> $tweetIds */
            $tweetIds = array_map('intval', $cluster['tweet_ids'] ?? []);
            $clusterTweets = $allTweets->whereIn('id', $tweetIds)->values();

            if ($clusterTweets->isEmpty()) {
                Log::channel('crawler-errors')->warning('SignalSummarizerService: cluster has no tweets', [
                    'cluster_id' => $clusterId,
                ]);

                return null;
            }

            $clusterTweets->loadMissing('source');

            $topic = isset($cluster['topic']) && is_string($cluster['topic']) ? $cluster['topic'] : '';
            $prompt = $this->buildPrompt($clusterTweets, $topic);

            $assistantText = $this->callSummarizeWithRetry($prompt);
            if ($assistantText === null) {
                Log::channel('crawler-errors')->error('SignalSummarizerService: LLM failed after retries', [
                    'cluster_id' => $clusterId,
                ]);

                return null;
            }

            $parsed = $this->parseAndValidate($assistantText, $clusterId);

            if ($parsed === null) {
                Log::channel('crawler-errors')->warning('SignalSummarizerService: parse failed, retrying with stricter prompt', [
                    'cluster_id' => $clusterId,
                ]);

                $assistantText = $this->callSummarizeWithRetry($prompt.self::STRICT_JSON_SUFFIX);
                if ($assistantText !== null) {
                    $parsed = $this->parseAndValidate($assistantText, $clusterId);
                }
            }

            if ($parsed === null) {
                Log::channel('crawler-errors')->error('SignalSummarizerService: could not parse summary JSON', [
                    'cluster_id' => $clusterId,
                ]);

                return null;
            }

            return [
                'cluster_id' => $clusterId,
                'title' => $parsed['title'],
                'summary' => $parsed['summary'],
                'topic_tags' => $parsed['topic_tags'],
                'source_count' => $clusterTweets->pluck('source_id')->unique()->count(),
                'tweet_ids' => $tweetIds,
            ];
        } catch (\Throwable $e) {
            Log::channel('crawler-errors')->error('SignalSummarizerService: unexpected error', [
                'cluster_id' => $clusterId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @param  Collection<int, Tweet>  $tweets
     */
    private function buildPrompt(Collection $tweets, string $topic): string
    {
        $formattedTweets = $tweets->map(function (Tweet $tweet, int $index): string {
            $handle = $tweet->source !== null
                ? ltrim((string) $tweet->source->x_handle, '@')
                : 'unknown';
            $timestamp = $tweet->posted_at !== null
                ? $tweet->posted_at->format('Y-m-d H:i')
                : 'unknown';

            return sprintf(
                "Tweet %d (@%s, %s):\n\"%s\"",
                $index + 1,
                $handle,
                $timestamp,
                (string) $tweet->text
            );
        })->implode("\n\n");

        return str_replace(
            ['{cluster_topic}', '{tweets_list}'],
            [$topic, $formattedTweets],
            $this->promptTemplate
        );
    }

    private function callSummarizeWithRetry(string $prompt): ?string
    {
        $lastException = null;

        for ($attempt = 1; $attempt <= self::LLM_ATTEMPTS; $attempt++) {
            try {
                return $this->resolveSummarizerLlm()->summarize($prompt);
            } catch (\Throwable $e) {
                $lastException = $e;
                Log::channel('crawler-errors')->warning('SignalSummarizerService: summarize attempt failed', [
                    'attempt' => $attempt,
                    'error' => $e->getMessage(),
                ]);

                if ($attempt < self::LLM_ATTEMPTS) {
                    usleep((int) (1_000_000 * (2 ** ($attempt - 1))));
                }
            }
        }

        if ($lastException instanceof \Throwable) {
            Log::channel('crawler-errors')->error('SignalSummarizerService: all summarize attempts failed', [
                'error' => $lastException->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * @return array{title: string, summary: string, topic_tags: list<string>}|null
     */
    private function parseAndValidate(string $response, string $clusterId): ?array
    {
        $data = $this->parseJsonFromResponse($response);
        if ($data === null) {
            $data = $this->parseWithRegex($response);
        }

        if ($data === null) {
            return null;
        }

        if (! isset($data['title'], $data['summary'], $data['topic_tags'])) {
            Log::channel('crawler-errors')->error('SignalSummarizerService: missing required fields', [
                'cluster_id' => $clusterId,
            ]);

            return null;
        }

        $title = trim((string) $data['title']);
        $titleWordCount = str_word_count($title);
        if ($titleWordCount > 10) {
            Log::channel('crawler')->warning('SignalSummarizerService: title exceeds 10 words', [
                'cluster_id' => $clusterId,
                'word_count' => $titleWordCount,
                'title' => $title,
            ]);
        }

        if (strlen($title) > 200) {
            $title = substr($title, 0, 197).'...';
            Log::channel('crawler')->warning('SignalSummarizerService: title truncated to 200 chars', [
                'cluster_id' => $clusterId,
            ]);
        }

        $summary = trim((string) $data['summary']);
        $summaryWordCount = str_word_count($summary);
        if ($summaryWordCount < 50 || $summaryWordCount > 100) {
            Log::channel('crawler')->warning('SignalSummarizerService: summary word count outside 50-100', [
                'cluster_id' => $clusterId,
                'word_count' => $summaryWordCount,
            ]);
        }

        $tags = $data['topic_tags'];
        if (! is_array($tags)) {
            $tags = [$tags];
        }

        /** @var list<string> $cleanTags */
        $cleanTags = [];
        foreach ($tags as $t) {
            $s = trim((string) $t);
            if ($s !== '') {
                $cleanTags[] = $s;
            }
        }
        $cleanTags = array_values(array_unique($cleanTags));

        if (count($cleanTags) < 1) {
            Log::channel('crawler')->warning('SignalSummarizerService: no topic tags, defaulting to Tech', [
                'cluster_id' => $clusterId,
            ]);
            $cleanTags = ['Tech'];
        }

        if (count($cleanTags) > 3) {
            Log::channel('crawler')->warning('SignalSummarizerService: too many tags, taking first 3', [
                'cluster_id' => $clusterId,
                'count' => count($cleanTags),
            ]);
            $cleanTags = array_slice($cleanTags, 0, 3);
        }

        return [
            'title' => $title,
            'summary' => $summary,
            'topic_tags' => $cleanTags,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function parseJsonFromResponse(string $response): ?array
    {
        $cleaned = preg_replace('/^```(?:json)?\s*/mi', '', $response) ?? $response;
        $cleaned = preg_replace('/\s*```$/m', '', $cleaned) ?? $cleaned;
        $cleaned = trim($cleaned);

        /** @var mixed $decoded */
        $decoded = json_decode($cleaned, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            /** @var array<string, mixed> $decoded */
            return $decoded;
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function parseWithRegex(string $response): ?array
    {
        $data = [];

        if (preg_match('/"title"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $response, $matches)) {
            $data['title'] = stripcslashes($matches[1]);
        }

        if (preg_match('/"summary"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $response, $matches)) {
            $data['summary'] = stripcslashes($matches[1]);
        }

        if (preg_match('/"topic_tags"\s*:\s*\[(.*?)\]/s', $response, $matches)) {
            $tagsStr = $matches[1];
            preg_match_all('/"((?:[^"\\\\]|\\\\.)*)"/', $tagsStr, $tagMatches);
            $data['topic_tags'] = array_map('stripcslashes', $tagMatches[1] ?? []);
        }

        if (isset($data['title'], $data['summary'], $data['topic_tags']) && is_array($data['topic_tags'])) {
            return $data;
        }

        return null;
    }

    private function resolveSummarizerLlm(): FakeLLMClient|LLMClient
    {
        if (config('app.mock_llm') === true) {
            return $this->fakeLlmClient;
        }

        return $this->llmClient;
    }
}
