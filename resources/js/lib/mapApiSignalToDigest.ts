import type { CategoryKey } from "@/components/CategoryBadge";
import type { Signal } from "@/types/signal";
import type { DigestSignal, KOLSource } from "@/types/digestUi";
import { apiSlugToCategoryKey } from "@/lib/categorySlugMap";

function normalizeTag(t: string): string {
  const s = t.trim();
  return s.startsWith("#") ? s : `#${s}`;
}

function mapCategories(categories: Signal["categories"]): Array<CategoryKey | string> {
  return categories.map((c) => {
    const key = apiSlugToCategoryKey(c.slug);
    return key ?? c.name;
  });
}

function mapSources(s: Signal): KOLSource[] {
  return s.sources.map((src) => ({
    handle: src.handle,
    name: src.display_name || src.handle,
    avatar: "",
    tweetPreview: undefined,
    timeAgo: "—",
    category: s.categories[0]?.name ?? "",
    tweetUrl: src.tweet_url,
    isMySource: src.is_my_source === true,
  }));
}

export function mapApiSignalToDigest(
  s: Signal,
  rank: number,
  options: { userPlan: "free" | "pro" | "power" },
): DigestSignal {
  const tags = (s.topic_tags ?? []).map(normalizeTag);
  const draft =
    options.userPlan !== "free" && s.draft_tweets?.length
      ? s.draft_tweets[0]?.text
      : undefined;

  return {
    id: String(s.id),
    rank,
    rankScore: s.rank_score,
    title: s.title,
    categories: mapCategories(s.categories ?? []),
    categoryIds: (s.categories ?? []).map((c) => c.id),
    tags,
    summary: s.summary,
    draftTweet: draft,
    kolCount: s.source_count,
    sourceCount: s.source_count,
    sources: mapSources(s),
    timeAgo: "—",
    defaultExpanded: false,
  };
}
