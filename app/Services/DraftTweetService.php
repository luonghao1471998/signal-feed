<?php

namespace App\Services;

use App\Integrations\LLMClient;
use App\Models\DraftTweet;
use App\Models\Signal;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class DraftTweetService
{
    private const MAX_TWEET_LENGTH = 280;

    private const MIN_TWEET_LENGTH = 80;

    private const TARGET_MIN_LENGTH = 120;

    private const TARGET_MAX_LENGTH = 200;

    private const CATEGORY_PRIORITY = [
        'Funding',
        'Acquisition',
        'Product Launch',
        'AI',
        'Research',
    ];

    public function __construct(
        private readonly LLMClient $llmClient,
        private readonly FakeLLMClient $fakeLlmClient
    ) {}

    /**
     * Generate shareable tweet draft cho một signal (fallback title nếu LLM lỗi).
     */
    public function generateDraft(Signal $signal): string
    {
        if ($signal->draft()->exists()) {
            Log::info('Draft đã tồn tại cho signal', [
                'signal_id' => $signal->id,
                'existing_draft' => $signal->draft->text,
            ]);

            return (string) $signal->draft->text;
        }

        try {
            return $this->generateDraftFromLlm($signal);
        } catch (\Throwable $e) {
            Log::error('Draft generation failed', [
                'signal_id' => $signal->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->generateFallbackDraft($signal);
        }
    }

    /**
     * Gọi LLM và lưu draft — ném exception nếu thất bại (dùng cho batch đếm lỗi).
     *
     * @throws \Throwable
     */
    public function generateDraftFromLlm(Signal $signal): string
    {
        if ($signal->draft()->exists()) {
            return (string) $signal->draft->text;
        }

        $prompt = $this->buildDraftPrompt($signal);
        $response = $this->resolveDraftLlm()->generateDraft($prompt);
        $draftText = $this->parseDraft($response, $signal);
        $draftText = $this->normalizeDraftLength($draftText, $signal);
        $this->validateDraft($draftText, $signal);

        DraftTweet::create([
            'signal_id' => $signal->id,
            'text' => $draftText,
            'tenant_id' => $signal->tenant_id ?? 1,
        ]);

        Log::info('Draft tweet generated thành công', [
            'signal_id' => $signal->id,
            'draft_length' => mb_strlen($draftText, 'UTF-8'),
            'draft' => $draftText,
        ]);

        return $draftText;
    }

    /**
     * Generate drafts cho nhiều signals (chỉ dùng với ít signals khi test).
     *
     * @param  \Illuminate\Support\Collection<int, Signal>  $signals
     * @return array{success: int, failed: int}
     */
    public function generateDraftsForSignals($signals): array
    {
        $success = 0;
        $failed = 0;

        foreach ($signals as $signal) {
            try {
                $this->generateDraftFromLlm($signal);
                $success++;
            } catch (\Throwable $e) {
                $failed++;
                Log::error('Batch draft generation failed cho signal', [
                    'signal_id' => $signal->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return ['success' => $success, 'failed' => $failed];
    }

    private function buildDraftPrompt(Signal $signal): string
    {
        $templatePath = base_path((string) config('anthropic.draft_prompt_path', 'docs/prompts/v1/generate-draft.md'));

        if (! File::exists($templatePath)) {
            throw new \RuntimeException("Draft prompt template không tìm thấy tại {$templatePath}");
        }

        $template = File::get($templatePath);
        $topicTags = $signal->topic_tags ?? [];
        $primaryCategory = $this->getPrimaryCategory(is_array($topicTags) ? $topicTags : []);
        $categoryGuidance = $this->getCategoryGuidance($primaryCategory);
        $categoryInstructions = $this->getCategoryInstructions($primaryCategory);

        return str_replace(
            [
                '{signal_title}',
                '{signal_summary}',
                '{topic_tags}',
                '{category_guidance}',
                '{category_specific_instructions}',
            ],
            [
                (string) $signal->title,
                $signal->summary !== null && $signal->summary !== '' ? (string) $signal->summary : 'N/A',
                implode(', ', is_array($topicTags) ? $topicTags : []),
                $categoryGuidance,
                $categoryInstructions,
            ],
            $template
        );
    }

    /**
     * @param  list<string>  $topicTags
     */
    private function getPrimaryCategory(array $topicTags): string
    {
        foreach (self::CATEGORY_PRIORITY as $category) {
            foreach ($topicTags as $tag) {
                if (is_string($tag) && strcasecmp($tag, $category) === 0) {
                    return $category;
                }
            }
        }

        return 'General';
    }

    private function getCategoryGuidance(string $category): string
    {
        return match ($category) {
            'Funding' => 'Investment/Funding announcement - focus on business impact',
            'Acquisition' => 'Company acquisition - focus on market consolidation',
            'Product Launch' => 'New product/feature - focus on user benefits',
            'AI' => 'AI/ML development - focus on technical capabilities',
            'Research' => 'Research breakthrough - focus on innovation',
            default => 'General tech industry news',
        };
    }

    private function getCategoryInstructions(string $category): string
    {
        return match ($category) {
            'Funding' => "**For Funding Announcements:**\n- MUST include investment amount (e.g., \"\$500M Series C\")\n- Mention lead investor if known\n- State new valuation if available\n- Business impact angle (\"becomes top-funded AI startup\")\n- Use 💰 emoji if appropriate",

            'Acquisition' => "**For Acquisitions:**\n- State acquirer and target company clearly\n- Include price if publicly known\n- Market consolidation angle (\"Major AI consolidation\")\n- Strategic rationale if obvious",

            'Product Launch' => "**For Product Launches:**\n- Highlight key user benefit or feature\n- Mention availability (\"Available now\", \"Coming Q3\")\n- Include pricing model if relevant (\"Free tier\", \"\$20/mo\")\n- Technical specs only if impressive\n- Use 🚀 emoji if appropriate",

            'AI' => "**For AI/ML News:**\n- Include performance metrics (\"10x faster\", \"128K context\")\n- Technical capabilities (\"multimodal\", \"real-time\")\n- Comparison to previous version if relevant\n- Pricing for API access if applicable\n- Use 📊 emoji if showing metrics",

            'Research' => "**For Research News:**\n- Mention research institution/company\n- State the innovation clearly\n- Potential applications if mentioned\n- Use 🔬 emoji if appropriate",

            default => "**General Tech News:**\n- Focus on most newsworthy aspect\n- Include key facts and figures\n- Professional, informative tone",
        };
    }

    private function parseDraft(string $response, Signal $signal): string
    {
        $cleaned = preg_replace('/```json\s*|\s*```/', '', $response);
        $cleaned = trim((string) $cleaned);

        $decoded = json_decode($cleaned, true);

        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($decoded)) {
            Log::warning('Failed to parse JSON response, attempting text extraction', [
                'signal_id' => $signal->id,
                'response' => $response,
                'json_error' => json_last_error_msg(),
            ]);

            return $this->extractDraftFromText($response);
        }

        $draft = $decoded['draft'] ?? null;

        if (! is_string($draft) || $draft === '') {
            throw new \RuntimeException('No draft field trong JSON response');
        }

        return trim($draft);
    }

    private function extractDraftFromText(string $response): string
    {
        if (preg_match('/"draft"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $response, $matches)) {
            return stripcslashes($matches[1]);
        }

        $trimmed = trim($response);

        return mb_substr($trimmed, 0, self::MAX_TWEET_LENGTH, 'UTF-8');
    }

    private function normalizeDraftLength(string $draft, Signal $signal): string
    {
        $len = mb_strlen($draft, 'UTF-8');
        if ($len <= self::MAX_TWEET_LENGTH) {
            return $draft;
        }

        Log::error('Draft vượt quá 280 character limit — truncate defensive', [
            'signal_id' => $signal->id,
            'length' => $len,
            'draft' => $draft,
        ]);

        return mb_substr($draft, 0, self::MAX_TWEET_LENGTH, 'UTF-8');
    }

    private function validateDraft(string $draft, Signal $signal): void
    {
        $length = mb_strlen($draft, 'UTF-8');

        if ($length < self::MIN_TWEET_LENGTH) {
            Log::warning('Draft dưới minimum recommended length', [
                'signal_id' => $signal->id,
                'length' => $length,
                'draft' => $draft,
            ]);
        }

        if ($length < self::TARGET_MIN_LENGTH || $length > self::TARGET_MAX_LENGTH) {
            Log::info('Draft ngoài target length range', [
                'signal_id' => $signal->id,
                'length' => $length,
                'target_range' => self::TARGET_MIN_LENGTH.'-'.self::TARGET_MAX_LENGTH,
            ]);
        }
    }

    private function generateFallbackDraft(Signal $signal): string
    {
        if ($signal->draft()->exists()) {
            return (string) $signal->draft->text;
        }

        $draft = (string) $signal->title;
        if (mb_strlen($draft, 'UTF-8') > self::MAX_TWEET_LENGTH) {
            $draft = mb_substr($draft, 0, self::MAX_TWEET_LENGTH - 3, 'UTF-8').'...';
        }

        DraftTweet::create([
            'signal_id' => $signal->id,
            'text' => $draft,
            'tenant_id' => $signal->tenant_id ?? 1,
        ]);

        Log::warning('Đã dùng fallback draft (signal title)', [
            'signal_id' => $signal->id,
            'draft' => $draft,
        ]);

        return $draft;
    }

    private function resolveDraftLlm(): FakeLLMClient|LLMClient
    {
        if (config('app.mock_llm') === true) {
            return $this->fakeLlmClient;
        }

        return $this->llmClient;
    }
}
