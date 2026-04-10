/** GET /api/signals — khớp SignalResource (backend). */

export interface SignalCategory {
  id: number;
  name: string;
  slug: string;
}

export interface SignalSource {
  handle: string;
  display_name: string;
  tweet_url: string | null;
  is_my_source?: boolean | null;
}

export interface DraftTweet {
  id: number;
  text: string;
}

export interface Signal {
  id: number;
  title: string;
  summary: string;
  source_count: number;
  rank_score: number;
  categories: SignalCategory[];
  topic_tags: string[];
  sources: SignalSource[];
  draft_tweets: DraftTweet[];
  date: string;
  type: number;
  is_personal: boolean;
}

export interface SignalsMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface SignalsResponse {
  data: Signal[];
  meta: SignalsMeta;
  links?: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
}
