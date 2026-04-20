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
    avatar: src.avatar_url ?? "",
    tweetPreview: undefined,
    timeAgo: "—",
    category: s.categories[0]?.name ?? "",
    tweetUrl: src.tweet_url,
    isMySource: src.is_my_source === true,
  }));
}

function toTimeAgo(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }

  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) {
    return "—";
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
    timeAgo: toTimeAgo(s.published_at ?? (s.date ? `${s.date}T00:00:00Z` : null)),
    defaultExpanded: false,
    isArchived: s.is_archived === true,
  };
}
