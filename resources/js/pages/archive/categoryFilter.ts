import { type CategoryKey } from "@/components/CategoryBadge";

export type ArchiveCategoryFilter =
  | "all"
  | "ai-ml"
  | "dev-tools"
  | "indie-saas"
  | "marketing"
  | "startup-vc"
  | "crypto";

const labelToFilterKey = (label: string): ArchiveCategoryFilter | null => {
  const n = label.toLowerCase().replace(/\s+/g, " ").trim();
  const map: Record<string, ArchiveCategoryFilter> = {
    "ai/ml": "ai-ml",
    "ai & ml": "ai-ml",
    "dev tools": "dev-tools",
    "indie saas": "indie-saas",
    "indie/saas": "indie-saas",
    marketing: "marketing",
    "startup/vc": "startup-vc",
    crypto: "crypto",
  };
  return map[n] ?? null;
};

export const categoryLabelToBadgeKey = (label: string): CategoryKey | null => {
  const fk = labelToFilterKey(label);
  if (!fk || fk === "all") return null;
  return fk as CategoryKey;
};

export const signalMatchesCategoryFilter = (
  categories: string[],
  filter: ArchiveCategoryFilter,
): boolean => {
  if (filter === "all") return true;
  return categories.some((c) => labelToFilterKey(c) === filter);
};
