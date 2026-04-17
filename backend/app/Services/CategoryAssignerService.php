<?php

namespace App\Services;

class CategoryAssignerService
{
    /** @var list<int> */
    private const AI_KEYWORDS = [
        'ai', 'ml', 'llm', 'gpt', 'claude', 'openai', 'machine learning', 'deep learning', 'neural networks',
    ];

    /**
     * Map topic tags to category IDs (1–10, theo bảng categories seed).
     *
     * @param  array<int, string>  $topicTags
     * @return list<int>
     */
    public function assignCategories(array $topicTags): array
    {
        $normalizedTags = array_map(static fn (string $t): string => strtolower(trim($t)), $topicTags);
        $normalizedTags = array_values(array_filter($normalizedTags, static fn (string $t): bool => $t !== ''));

        $categories = [];

        if ($this->matchesAny($normalizedTags, ['ai', 'ml', 'llm', 'gpt', 'claude', 'openai', 'machine learning', 'deep learning', 'neural networks'])) {
            $categories[] = 1;
        }

        if ($this->matchesAny($normalizedTags, ['crypto', 'web3', 'blockchain', 'nft', 'defi', 'ethereum', 'bitcoin'])) {
            $categories[] = 2;
        }

        if ($this->matchesAny($normalizedTags, ['marketing', 'growth', 'seo', 'content', 'ads', 'social media'])) {
            $categories[] = 3;
        }

        if ($this->matchesAny($normalizedTags, ['startups', 'funding', 'vc', 'seed', 'series a', 'series b', 'series c', 'ipo', 'acquisition'])) {
            $categories[] = 4;
        }

        if ($this->matchesAny($normalizedTags, ['product launch', 'release', 'announcement', 'news', 'update', 'security', 'media'])) {
            $categories[] = 5;
        }

        if ($this->matchesAny($normalizedTags, ['developer tools', 'devops', 'cli', 'api', 'framework', 'library', 'ide', 'software'])) {
            $categories[] = 6;
        }

        if ($this->matchesAny($normalizedTags, ['design', 'ui', 'ux', 'figma', 'typography', 'branding'])) {
            $categories[] = 7;
        }

        if ($this->matchesAny($normalizedTags, ['saas', 'b2b', 'enterprise', 'cloud', 'platform'])) {
            $categories[] = 8;
        }

        if ($this->matchesAny($normalizedTags, ['indie hacking', 'solo', 'side project', 'bootstrapped', 'revenue'])) {
            $categories[] = 9;
        }

        if ($this->matchesAny($normalizedTags, ['productivity', 'workflow', 'automation', 'tools', 'efficiency'])) {
            $categories[] = 10;
        }

        if ($this->hasResearchTag($normalizedTags)) {
            $hasAiContext = $this->matchesAny($normalizedTags, self::AI_KEYWORDS)
                || in_array(1, $categories, true);

            if ($hasAiContext) {
                if (! in_array(1, $categories, true)) {
                    $categories[] = 1;
                }
            } elseif (! in_array(5, $categories, true)) {
                $categories[] = 5;
            }
        }

        sort($categories);

        return array_values(array_unique($categories));
    }

    /**
     * @param  list<string>  $tags  Lowercased
     * @param  list<string>  $keywords  Lowercased phrases/words
     */
    private function matchesAny(array $tags, array $keywords): bool
    {
        foreach ($tags as $tag) {
            foreach ($keywords as $keyword) {
                if ($keyword === '') {
                    continue;
                }
                if (str_contains($keyword, ' ')) {
                    if (str_contains($tag, $keyword)) {
                        return true;
                    }

                    continue;
                }
                if (strlen($keyword) <= 3) {
                    if ($tag === $keyword) {
                        return true;
                    }
                    if (preg_match('/\b'.preg_quote($keyword, '/').'\b/', $tag) === 1) {
                        return true;
                    }

                    continue;
                }
                if (str_contains($tag, $keyword)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @param  list<string>  $normalizedTags
     */
    private function hasResearchTag(array $normalizedTags): bool
    {
        foreach ($normalizedTags as $tag) {
            if ($tag === 'research' || str_contains($tag, 'research')) {
                return true;
            }
        }

        return false;
    }
}
