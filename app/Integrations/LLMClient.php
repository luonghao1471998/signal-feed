<?php

namespace App\Integrations;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LLMClient
{
    private string $apiKey;

    private string $apiVersion;

    private string $baseUrl;

    private int $timeout;

    private int $maxRetries;

    /** @var array{name: string, max_tokens: int, temperature: float} */
    private array $modelConfig;

    private string $promptPath;

    public function __construct()
    {
        $this->apiKey = (string) (config('anthropic.api_key') ?? '');
        $this->apiVersion = (string) config('anthropic.api_version', '2023-06-01');
        $this->baseUrl = rtrim((string) config('anthropic.base_url', 'https://api.anthropic.com'), '/');
        $this->timeout = (int) config('anthropic.timeout', 60);
        $this->maxRetries = (int) config('anthropic.max_retries', 3);
        /** @var array{name?: string, max_tokens?: int, temperature?: float} $cfg */
        $cfg = config('anthropic.models.classify', []);
        $this->modelConfig = [
            'name' => (string) ($cfg['name'] ?? 'claude-sonnet-4-20250514'),
            'max_tokens' => (int) ($cfg['max_tokens'] ?? 256),
            'temperature' => (float) ($cfg['temperature'] ?? 0.1),
        ];
        $this->promptPath = (string) config('anthropic.classify_prompt_path', 'docs/prompts/v1/classify.md');
    }

    /**
     * @return array{signal_score: float, is_signal: bool}
     */
    public function classify(string $tweetText): array
    {
        if ($this->apiKey === '') {
            throw new \RuntimeException('ANTHROPIC_API_KEY is not configured.');
        }

        $prompt = $this->buildClassifyPrompt($tweetText);

        $response = Http::withHeaders([
            'x-api-key' => $this->apiKey,
            'anthropic-version' => $this->apiVersion,
            'content-type' => 'application/json',
        ])
            ->timeout($this->timeout)
            ->retry($this->maxRetries, 1000, function ($exception) {
                return $exception instanceof ConnectionException;
            })
            ->post("{$this->baseUrl}/v1/messages", [
                'model' => $this->modelConfig['name'],
                'max_tokens' => $this->modelConfig['max_tokens'],
                'temperature' => $this->modelConfig['temperature'],
                'messages' => [['role' => 'user', 'content' => $prompt]],
            ]);

        if ($response->failed()) {
            Log::error('LLMClient::classify API failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \RuntimeException('Claude classify failed: '.$response->body());
        }

        return $this->parseClassifyResponse((string) $response->body());
    }

    /**
     * Gửi prompt clustering; trả về nội dung text (JSON thuần) từ assistant.
     *
     * @throws \RuntimeException
     */
    public function cluster(string $userPrompt): string
    {
        if ($this->apiKey === '') {
            throw new \RuntimeException('ANTHROPIC_API_KEY is not configured.');
        }

        /** @var array{name?: string, max_tokens?: int, temperature?: float} $cfg */
        $cfg = config('anthropic.models.cluster', []);
        $clusterModel = [
            'name' => (string) ($cfg['name'] ?? 'claude-sonnet-4-20250514'),
            'max_tokens' => (int) ($cfg['max_tokens'] ?? 4096),
            'temperature' => (float) ($cfg['temperature'] ?? 0.2),
        ];

        $response = Http::withHeaders([
            'x-api-key' => $this->apiKey,
            'anthropic-version' => $this->apiVersion,
            'content-type' => 'application/json',
        ])
            ->timeout($this->timeout)
            ->retry($this->maxRetries, 1000, function ($exception) {
                return $exception instanceof ConnectionException;
            })
            ->post("{$this->baseUrl}/v1/messages", [
                'model' => $clusterModel['name'],
                'max_tokens' => $clusterModel['max_tokens'],
                'temperature' => $clusterModel['temperature'],
                'messages' => [['role' => 'user', 'content' => $userPrompt]],
            ]);

        if ($response->failed()) {
            Log::error('LLMClient::cluster API failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \RuntimeException('Claude cluster failed: '.$response->body());
        }

        return $this->extractAssistantText((string) $response->body());
    }

    /**
     * Gửi prompt tóm tắt cluster → JSON signal (title, summary, topic_tags).
     * Không dùng Http::retry — caller (SignalSummarizerService) tự retry + backoff.
     *
     * @throws \RuntimeException
     */
    public function summarize(string $userPrompt): string
    {
        if ($this->apiKey === '') {
            throw new \RuntimeException('ANTHROPIC_API_KEY is not configured.');
        }

        /** @var array{name?: string, max_tokens?: int, temperature?: float} $cfg */
        $cfg = config('anthropic.models.summarize', []);
        $summarizeModel = [
            'name' => (string) ($cfg['name'] ?? 'claude-sonnet-4-20250514'),
            'max_tokens' => (int) ($cfg['max_tokens'] ?? 500),
            'temperature' => (float) ($cfg['temperature'] ?? 0.3),
        ];

        $response = Http::withHeaders([
            'x-api-key' => $this->apiKey,
            'anthropic-version' => $this->apiVersion,
            'content-type' => 'application/json',
        ])
            ->timeout($this->timeout)
            ->post("{$this->baseUrl}/v1/messages", [
                'model' => $summarizeModel['name'],
                'max_tokens' => $summarizeModel['max_tokens'],
                'temperature' => $summarizeModel['temperature'],
                'messages' => [['role' => 'user', 'content' => $userPrompt]],
            ]);

        if ($response->failed()) {
            Log::error('LLMClient::summarize API failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \RuntimeException('Claude summarize failed: '.$response->body());
        }

        return $this->extractAssistantText((string) $response->body());
    }

    private function buildClassifyPrompt(string $tweetText): string
    {
        $path = base_path($this->promptPath);
        if (! File::isFile($path)) {
            throw new \RuntimeException("Classify prompt file missing: {$this->promptPath}");
        }

        $template = File::get($path);

        return str_replace('{{TWEET_TEXT}}', $tweetText, $template);
    }

    /**
     * @return array{signal_score: float, is_signal: bool}
     */
    private function parseClassifyResponse(string $responseBody): array
    {
        $text = $this->extractAssistantText($responseBody);

        /** @var mixed $decoded */
        $decoded = json_decode($text, true);
        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($decoded)) {
            throw new \RuntimeException('Classify JSON parse error: '.json_last_error_msg());
        }

        if (! array_key_exists('signal_score', $decoded)) {
            throw new \RuntimeException('Classify JSON missing signal_score');
        }

        $score = (float) $decoded['signal_score'];
        $score = max(0.0, min(1.0, $score));
        $score = round($score, 2);

        $threshold = (float) config('signalfeed.signal_threshold', 0.6);
        $isSignal = array_key_exists('is_signal', $decoded)
            ? (bool) $decoded['is_signal']
            : $score >= $threshold;

        return [
            'signal_score' => $score,
            'is_signal' => $isSignal,
        ];
    }

    /**
     * Lấy text thuần từ body Messages API (bỏ markdown fence nếu có).
     *
     * @throws \RuntimeException
     */
    private function extractAssistantText(string $responseBody): string
    {
        /** @var array<string, mixed>|null $data */
        $data = json_decode($responseBody, true);
        if (! is_array($data) || ! isset($data['content'][0]['text'])) {
            throw new \RuntimeException('Invalid Claude response structure');
        }

        $text = (string) $data['content'][0]['text'];
        $text = preg_replace('/^```json\s*/m', '', $text) ?? $text;
        $text = preg_replace('/\s*```$/m', '', $text) ?? $text;

        return trim($text);
    }
}
