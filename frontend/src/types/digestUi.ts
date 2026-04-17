import type { CategoryKey } from "@/components/CategoryBadge";

/** Nguồn KOL hiển thị trên card (đã map từ API). */
export interface KOLSource {
  handle: string;
  name: string;
  avatar: string;
  tweetPreview?: string;
  timeAgo: string;
  category: string;
  /** URL tweet gốc từ API (nếu có). */
  tweetUrl?: string | null;
  /** Pro/Power: theo my_source_subscriptions. */
  isMySource?: boolean;
}

/**
 * Model hiển thị Digest (card + bottom sheet).
 * categories: CategoryKey (badge) hoặc chuỗi tên khi slug API chưa map được.
 */
export interface DigestSignal {
  id: string;
  rank: number;
  rankScore: number;
  title: string;
  categories: Array<CategoryKey | string>;
  /** ID category từ API (digest pills / filter). */
  categoryIds: number[];
  tags: string[];
  summary: string;
  draftTweet?: string;
  kolCount: number;
  sourceCount?: number;
  sources: KOLSource[];
  timeAgo: string;
  defaultExpanded?: boolean;
  /** Từ API is_archived; optimistic toggle trên DigestPage */
  isArchived?: boolean;
}
