import type { CategoryKey } from "@/components/CategoryBadge";
import type { CategoryFilterKey } from "@/contexts/CategoryFilterContext";

/** Map slug trong DB → CategoryKey (badge UI). */
const DB_SLUG_TO_UI: Record<string, CategoryKey> = {
  "ai-ml": "ai-ml",
  "dev-tools": "dev-tools",
  "marketing": "marketing",
  "crypto-web3": "crypto",
  startups: "startup-vc",
  "tech-news": "tech-policy",
  design: "design-product",
  saas: "indie-saas",
  "indie-hacking": "indie-saas",
  productivity: "finance",
};

/** Map pill digest (UI) → slug trong bảng categories (seed). */
const UI_KEY_TO_DB_SLUG: Partial<Record<CategoryKey, string>> = {
  "ai-ml": "ai-ml",
  "dev-tools": "dev-tools",
  "indie-saas": "indie-hacking",
  marketing: "marketing",
  "startup-vc": "startups",
  crypto: "crypto-web3",
  finance: "productivity",
  "design-product": "design",
  creator: "indie-hacking",
  "tech-policy": "tech-news",
};

export function apiSlugToCategoryKey(slug: string): CategoryKey | null {
  return DB_SLUG_TO_UI[slug] ?? null;
}

export function categoryFilterKeyToDbSlug(key: CategoryFilterKey): string | null {
  if (key === "all") {
    return null;
  }
  return UI_KEY_TO_DB_SLUG[key] ?? key;
}
