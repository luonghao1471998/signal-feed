import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { type CategoryKey } from "@/components/CategoryBadge";

export type CategoryFilterKey = "all" | CategoryKey;

export type CategoryFilterItem = {
  key: CategoryFilterKey;
  label: string;
  /** Filled dot (active sidebar / pill helper) */
  dotColor: string;
  /** Outlined / muted dot for inactive sidebar */
  dotOutline: string;
};

export const DIGEST_FILTER_CATEGORIES: CategoryFilterItem[] = [
  { key: "all", label: "All", dotColor: "bg-slate-500", dotOutline: "border border-slate-300 bg-transparent" },
  {
    key: "ai-ml",
    label: "AI & ML",
    dotColor: "bg-[hsl(var(--cat-ai-ml-text))]",
    dotOutline: "border border-[hsl(var(--cat-ai-ml-text))] bg-transparent opacity-50",
  },
  {
    key: "dev-tools",
    label: "Dev Tools",
    dotColor: "bg-[hsl(var(--cat-dev-tools-text))]",
    dotOutline: "border border-[hsl(var(--cat-dev-tools-text))] bg-transparent opacity-50",
  },
  {
    key: "indie-saas",
    label: "Indie/SaaS",
    dotColor: "bg-[hsl(var(--cat-indie-saas-text))]",
    dotOutline: "border border-[hsl(var(--cat-indie-saas-text))] bg-transparent opacity-50",
  },
  {
    key: "marketing",
    label: "Marketing",
    dotColor: "bg-[hsl(var(--cat-marketing-text))]",
    dotOutline: "border border-[hsl(var(--cat-marketing-text))] bg-transparent opacity-50",
  },
  {
    key: "startup-vc",
    label: "Startup/VC",
    dotColor: "bg-[hsl(var(--cat-startup-vc-text))]",
    dotOutline: "border border-[hsl(var(--cat-startup-vc-text))] bg-transparent opacity-50",
  },
  {
    key: "crypto",
    label: "Crypto",
    dotColor: "bg-[hsl(var(--cat-crypto-text))]",
    dotOutline: "border border-[hsl(var(--cat-crypto-text))] bg-transparent opacity-50",
  },
  {
    key: "finance",
    label: "Finance",
    dotColor: "bg-[hsl(var(--cat-finance-text))]",
    dotOutline: "border border-[hsl(var(--cat-finance-text))] bg-transparent opacity-50",
  },
  {
    key: "design-product",
    label: "Design",
    dotColor: "bg-[hsl(var(--cat-design-product-text))]",
    dotOutline: "border border-[hsl(var(--cat-design-product-text))] bg-transparent opacity-50",
  },
  {
    key: "creator",
    label: "Creator",
    dotColor: "bg-[hsl(var(--cat-creator-text))]",
    dotOutline: "border border-[hsl(var(--cat-creator-text))] bg-transparent opacity-50",
  },
  {
    key: "tech-policy",
    label: "Tech Policy",
    dotColor: "bg-[hsl(var(--cat-tech-policy-text))]",
    dotOutline: "border border-[hsl(var(--cat-tech-policy-text))] bg-transparent opacity-50",
  },
];

const ARCHIVE_KEYS = new Set<CategoryFilterKey>([
  "all",
  "ai-ml",
  "dev-tools",
  "indie-saas",
  "marketing",
  "startup-vc",
  "crypto",
]);

export const ARCHIVE_FILTER_CATEGORIES = DIGEST_FILTER_CATEGORIES.filter((c) => ARCHIVE_KEYS.has(c.key));

export function categoriesForSidebarPath(pathname: string): CategoryFilterItem[] {
  if (pathname === "/archive" || pathname.startsWith("/archive/")) return ARCHIVE_FILTER_CATEGORIES;
  if (
    pathname === "/digest" ||
    pathname.startsWith("/digest/") ||
    pathname === "/my-kols" ||
    pathname.startsWith("/my-kols/")
  ) {
    return DIGEST_FILTER_CATEGORIES;
  }
  return [];
}

export function isCategoryAllowedOnPath(pathname: string, key: CategoryFilterKey): boolean {
  if (pathname === "/archive" || pathname.startsWith("/archive/")) return ARCHIVE_KEYS.has(key);
  if (
    pathname === "/digest" ||
    pathname.startsWith("/digest/") ||
    pathname === "/my-kols" ||
    pathname.startsWith("/my-kols/")
  ) {
    return true;
  }
  return false;
}

const PATHS_HIDE_SIDEBAR_CATEGORIES = new Set([
  "/settings",
  "/login",
  "/onboarding",
  "/onboarding/follow",
]);

function pathShowsSidebarCategories(pathname: string): boolean {
  if (pathname === "/digest" || pathname.startsWith("/digest/")) return true;
  if (pathname === "/my-kols" || pathname.startsWith("/my-kols/")) return true;
  if (pathname === "/archive" || pathname.startsWith("/archive/")) return true;
  return false;
}

export function shouldShowSidebarCategories(pathname: string): boolean {
  if (PATHS_HIDE_SIDEBAR_CATEGORIES.has(pathname)) return false;
  return pathShowsSidebarCategories(pathname);
}

type CategoryFilterContextValue = {
  activeCategory: CategoryFilterKey;
  setCategory: (key: CategoryFilterKey) => void;
  /** Set active category exactly (e.g. mobile filter sheet). */
  selectCategory: (key: CategoryFilterKey) => void;
};

const CategoryFilterContext = createContext<CategoryFilterContextValue | null>(null);

export function CategoryFilterProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [activeCategory, setActiveCategoryState] = useState<CategoryFilterKey>("all");

  useEffect(() => {
    setActiveCategoryState((prev) =>
      isCategoryAllowedOnPath(location.pathname, prev) ? prev : "all",
    );
  }, [location.pathname]);

  const setCategory = useCallback((key: CategoryFilterKey) => {
    setActiveCategoryState((prev) => {
      if (key === "all") return "all";
      return prev === key ? "all" : key;
    });
  }, []);

  const selectCategory = useCallback((key: CategoryFilterKey) => {
    setActiveCategoryState(key);
  }, []);

  const value = useMemo(
    () => ({
      activeCategory,
      setCategory,
      selectCategory,
    }),
    [activeCategory, setCategory, selectCategory],
  );

  return <CategoryFilterContext.Provider value={value}>{children}</CategoryFilterContext.Provider>;
}

export function useCategoryFilter(): CategoryFilterContextValue {
  const ctx = useContext(CategoryFilterContext);
  if (!ctx) {
    throw new Error("useCategoryFilter must be used within CategoryFilterProvider");
  }
  return ctx;
}
