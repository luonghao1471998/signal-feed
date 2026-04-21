import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Zap } from "lucide-react";
import DigestSignalCard from "../components/DigestSignalCard";
import PipelineFooter from "../components/PipelineFooter";
import MySourcesStatsBar from "../components/MySourcesStatsBar";
import { SignalDetailModal } from "@/components/SignalDetailModal";
import { categoryLabel } from "@/components/CategoryBadge";
import FilterSheet from "../components/FilterSheet";
import { useCategoryFilter } from "@/contexts/CategoryFilterContext";
import type { CategoryFilterKey } from "@/contexts/CategoryFilterContext";
import { DIGEST_TOPIC_TAGS } from "../data/digestTopicTags";
import { ALL_CATEGORIES } from "@/constants/categories";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useDigestSidebarOptional } from "@/contexts/DigestSidebarContext";
import { toast } from "sonner";
import {
  archiveSignal,
  fetchCategories,
  fetchSignals,
  unarchiveSignal,
  type ApiCategory,
} from "@/services/signalService";
import { getCurrentSubscriptionCount } from "@/services/sourceService";
import { mapApiSignalToDigest } from "@/lib/mapApiSignalToDigest";
import { categoryFilterKeyToDbSlug, apiSlugToCategoryKey } from "@/lib/categorySlugMap";
import type { DigestSignal } from "@/types/digestUi";
import { useLocale } from "@/i18n";

interface CategoryPill {
  id: number | null;
  name: string;
  slug: string;
  hasSignals: boolean;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDateYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function digestSubtitleFromParam(dateParam: string | undefined, todayLabel: string, locale: "en" | "vi"): string {
  if (!dateParam) return todayLabel;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
  if (!m) return dateParam;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function resolveCategoryId(activeCategory: CategoryFilterKey, categories: ApiCategory[]): number | null {
  const slug = categoryFilterKeyToDbSlug(activeCategory);
  if (!slug) {
    return null;
  }
  const row = categories.find((c) => c.slug === slug);
  return row?.id ?? null;
}

const DigestPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { date: dateParam } = useParams<{ date?: string }>();
  const { user, token, authReady } = useAuth();
  const { t, locale } = useLocale();
  const userPlan = user?.plan ?? "free";

  const [filterDate, setFilterDate] = useState(() => dateParam ?? todayYmd());
  const [myKolsOnly, setMyKolsOnly] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [selectedSignalId, setSelectedSignalId] = useState<number | null>(null);
  const [selectedListRank, setSelectedListRank] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [rawSignals, setRawSignals] = useState<DigestSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());
  const [archiveLoadingIds, setArchiveLoadingIds] = useState<Set<number>>(new Set());
  const [deepLinkHandledSignalId, setDeepLinkHandledSignalId] = useState<number | null>(null);
  const [newSignalsCount, setNewSignalsCount] = useState(0);

  const isMobile = useMediaQuery("(max-width: 767px)");
  const { activeCategory, selectCategory } = useCategoryFilter();
  const digestSidebar = useDigestSidebarOptional();

  useEffect(() => {
    if (dateParam) {
      setFilterDate(dateParam);
    }
  }, [dateParam]);

  useEffect(() => {
    if (!dateParam) {
      navigate(`/digest/${filterDate}`, { replace: true });
    }
  }, [dateParam, navigate, filterDate]);

  useEffect(() => {
    setActiveTags([]);
    setSelectedCategoryIds([]);
  }, [filterDate]);

  useEffect(() => {
    if (userPlan === "free" && myKolsOnly) {
      setMyKolsOnly(false);
    }
  }, [userPlan, myKolsOnly]);

  useEffect(() => {
    let cancelled = false;
    if (!authReady || (!user && !token)) {
      setSubscriptionCount(0);
      return;
    }

    void (async () => {
      try {
        const count = await getCurrentSubscriptionCount();
        if (!cancelled) {
          setSubscriptionCount(count);
        }
      } catch {
        if (!cancelled) {
          setSubscriptionCount(0);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchCategories();
        if (!cancelled) {
          setApiCategories(list);
        }
      } catch {
        if (!cancelled) {
          setApiCategories([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const categoryIdsForApi = isMobile
        ? activeCategory === "all"
          ? []
          : (() => {
              const id = resolveCategoryId(activeCategory, apiCategories);
              return id ? [id] : [];
            })()
        : selectedCategoryIds;

      const mySourcesOnly = myKolsOnly;
      const topicTag =
        userPlan !== "free" && activeTags.length === 1 ? activeTags[0].replace(/^#/, "") : undefined;

      const response = await fetchSignals({
        date: filterDate,
        categoryIds: categoryIdsForApi.length ? categoryIdsForApi : undefined,
        mySourcesOnly,
        topicTag,
        page: currentPage,
        perPage: 100,
      });

      const plan = userPlan;
      const mapped = response.data.map((s, i) =>
        mapApiSignalToDigest(s, (response.meta.current_page - 1) * response.meta.per_page + i + 1, {
          userPlan: plan,
        }),
      );
      setRawSignals(mapped);
      setTotal(response.meta.total);
      setCurrentPage(response.meta.current_page);
      setLastPage(response.meta.last_page ?? Math.max(1, Math.ceil(response.meta.total / response.meta.per_page)));

    } catch (e) {
      setRawSignals([]);
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [
    isMobile,
    activeCategory,
    apiCategories,
    selectedCategoryIds,
    filterDate,
    myKolsOnly,
    userPlan,
    currentPage,
    activeTags,
  ]);

  const checkForNewSignals = useCallback(async () => {
    if (!authReady || (!user && !token) || loading) {
      return;
    }

    try {
      const categoryIdsForApi = isMobile
        ? activeCategory === "all"
          ? []
          : (() => {
              const id = resolveCategoryId(activeCategory, apiCategories);
              return id ? [id] : [];
            })()
        : selectedCategoryIds;

      const mySourcesOnly = myKolsOnly;
      const topicTag =
        userPlan !== "free" && activeTags.length === 1 ? activeTags[0].replace(/^#/, "") : undefined;

      const response = await fetchSignals({
        date: filterDate,
        categoryIds: categoryIdsForApi.length ? categoryIdsForApi : undefined,
        mySourcesOnly,
        topicTag,
        page: 1,
        perPage: 1,
      });

      const diff = response.meta.total - total;
      setNewSignalsCount(diff > 0 ? diff : 0);
    } catch {
      setNewSignalsCount(0);
    }
  }, [
    authReady,
    user,
    token,
    loading,
    isMobile,
    activeCategory,
    apiCategories,
    selectedCategoryIds,
    myKolsOnly,
    userPlan,
    activeTags,
    filterDate,
    total,
  ]);

  useEffect(() => {
    if (!authReady) {
      return;
    }
    if (!user && !token) {
      setLoading(false);
      setError(t("digest.authRequired"));
      setRawSignals([]);
      return;
    }
    void loadSignals();
    setNewSignalsCount(0);
  }, [loadSignals, authReady, user, token]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForNewSignals();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [checkForNewSignals]);

  const aggregatedTopicTags = useMemo(() => {
    const uniq = new Set<string>();
    rawSignals.forEach((s) => {
      s.tags.forEach((t) => uniq.add(t));
    });
    return Array.from(uniq).slice(0, 6);
  }, [rawSignals]);

  const topicTagsForHeader = aggregatedTopicTags.length > 0 ? aggregatedTopicTags : DIGEST_TOPIC_TAGS;

  useEffect(() => {
    if (!digestSidebar) {
      return;
    }

    const handleSet = new Set<string>();
    rawSignals.forEach((s) => {
      s.sources.forEach((src) => handleSet.add(src.handle));
    });

    const byHandle = new Map<
      string,
      { displayName: string; signalIds: Set<string>; avatarUrl: string | null }
    >();
    rawSignals.forEach((sig) => {
      sig.sources.forEach((src) => {
        const h = src.handle;
        const avatarFromApi = src.avatar?.trim() ? src.avatar.trim() : null;
        if (!byHandle.has(h)) {
          byHandle.set(h, {
            displayName: src.name,
            signalIds: new Set([sig.id]),
            avatarUrl: avatarFromApi,
          });
        } else {
          const row = byHandle.get(h)!;
          row.signalIds.add(sig.id);
          if (!row.avatarUrl && avatarFromApi) {
            row.avatarUrl = avatarFromApi;
          }
        }
      });
    });

    const topKols = Array.from(byHandle.entries())
      .map(([handle, v]) => ({
        handle,
        displayName: v.displayName,
        signalCount: v.signalIds.size,
        avatarUrl: v.avatarUrl,
      }))
      .sort((a, b) => b.signalCount - a.signalCount);

    digestSidebar.setSnapshot({
      signalTotal: total,
      kolsActive: handleSet.size,
      topicTags: Array.from(new Set(rawSignals.flatMap((s) => s.tags))).slice(0, 6),
      topKols,
      loading,
    });
  }, [digestSidebar, rawSignals, total, loading]);

  useEffect(() => {
    setArchivedIds(new Set(rawSignals.filter((s) => s.isArchived).map((s) => Number(s.id))));
  }, [rawSignals]);

  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    const target = Number(qp.get("signal_id") ?? "");
    if (!Number.isFinite(target) || target <= 0) {
      if (deepLinkHandledSignalId !== null) {
        setDeepLinkHandledSignalId(null);
      }
      return;
    }
    if (deepLinkHandledSignalId === target) {
      return;
    }
    const idx = rawSignals.findIndex((s) => Number(s.id) === target);
    if (idx < 0) {
      return;
    }
    const found = rawSignals[idx];
    setSelectedSignalId(target);
    setSelectedListRank(found.rank ?? idx + 1);
    setIsDetailModalOpen(true);
    setDeepLinkHandledSignalId(target);
  }, [location.search, rawSignals, deepLinkHandledSignalId]);

  useEffect(() => {
    return () => {
      digestSidebar?.setSnapshot(null);
    };
  }, [digestSidebar]);

  const handleArchiveToggle = useCallback(async (signalIdStr: string, wasArchived: boolean) => {
    const id = Number(signalIdStr);
    setArchivedIds((prev) => {
      const n = new Set(prev);
      if (wasArchived) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
    setArchiveLoadingIds((prev) => new Set(prev).add(id));
    try {
      if (wasArchived) {
        await unarchiveSignal(id);
        toast.success(t("digest.archiveRemoved"));
      } else {
        await archiveSignal(id);
        toast.success(t("digest.archiveSaved"));
      }
    } catch {
      toast.error(t("digest.archiveFailed"));
      setArchivedIds((prev) => {
        const n = new Set(prev);
        if (wasArchived) {
          n.add(id);
        } else {
          n.delete(id);
        }
        return n;
      });
    } finally {
      setArchiveLoadingIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }, []);

  const visibleSignals = useMemo(() => {
    let list = rawSignals;
    const clientTagFilter =
      activeTags.length > 1 || (userPlan === "free" && activeTags.length > 0);
    if (clientTagFilter) {
      list = list.filter((s) =>
        activeTags.every((tag) => {
          const norm = tag.startsWith("#") ? tag.slice(1) : tag;
          return s.tags.some((t) => {
            const tt = t.replace(/^#/, "").toLowerCase();
            return tt === norm.toLowerCase() || t === tag;
          });
        }),
      );
    }
    return list;
  }, [rawSignals, activeTags, userPlan]);

  const clientTagFiltered =
    activeTags.length > 1 || (userPlan === "free" && activeTags.length > 0);
  const signalCount = clientTagFiltered ? visibleSignals.length : total;

  const myKolsTopHandles = useMemo(() => {
    if (!myKolsOnly) {
      return [];
    }
    const basis = clientTagFiltered ? visibleSignals : rawSignals;
    const byHandle = new Map<string, number>();
    basis.forEach((sig) => {
      const seen = new Set<string>();
      sig.sources.forEach((src) => {
        const h = src.handle;
        if (seen.has(h)) {
          return;
        }
        seen.add(h);
        byHandle.set(h, (byHandle.get(h) ?? 0) + 1);
      });
    });
    return Array.from(byHandle.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => h);
  }, [myKolsOnly, clientTagFiltered, visibleSignals, rawSignals]);

  const categoryPills = useMemo((): CategoryPill[] => {
    const signals = rawSignals;
    const activeCategoryIds = new Set(signals.flatMap((s) => s.categoryIds));
    const myCats = user?.my_categories ?? [];

    /** Chuyển DB slug → display name đồng bộ với badge trên signal card. */
    const resolveDisplayName = (slug: string, fallback: string): string => {
      const uiKey = apiSlugToCategoryKey(slug);
      return uiKey ? categoryLabel(uiKey) : fallback;
    };

    // Không có signal hôm nay: hiện my_categories (hoặc tất cả) ở trạng thái disabled
    if (activeCategoryIds.size === 0) {
      const base =
        myCats.length > 0
          ? ALL_CATEGORIES.filter((cat) => myCats.includes(cat.id))
          : [...ALL_CATEGORIES];
      return [
        { id: null, name: t("common.all"), slug: "all", hasSignals: false },
        ...base.map((cat) => ({
          id: cat.id,
          name: resolveDisplayName(cat.slug, cat.name),
          slug: cat.slug,
          hasSignals: false,
        })),
      ];
    }

    // Có signal: chỉ hiện categories có signal ngày đang xem
    // my_categories ưu tiên lên đầu, còn lại sort alphabet
    const active = ALL_CATEGORIES.filter((cat) => activeCategoryIds.has(cat.id));
    active.sort((a, b) => {
      const aIsMine = myCats.includes(a.id);
      const bIsMine = myCats.includes(b.id);
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      return a.name.localeCompare(b.name);
    });

    return [
      { id: null, name: t("common.all"), slug: "all", hasSignals: true },
      ...active.map((cat) => ({
        id: cat.id,
        name: resolveDisplayName(cat.slug, cat.name),
        slug: cat.slug,
        hasSignals: true,
      })),
    ];
  }, [rawSignals, user?.my_categories, t]);

  /**
   * Convert categoryPills → format cho FilterSheet mobile (CategoryFilterKey + label).
   * Deduplicate: saas + indie-hacking đều map về "indie-saas" → chỉ lấy một.
   */
  const mobileCategoryOptions = useMemo((): Array<{ key: CategoryFilterKey; label: string }> => {
    const seen = new Set<string>();
    const result: Array<{ key: CategoryFilterKey; label: string }> = [];

    for (const pill of categoryPills) {
      if (pill.id === null) {
        if (!seen.has("all")) {
          seen.add("all");
          result.push({ key: "all", label: pill.name });
        }
        continue;
      }
      const uiKey = apiSlugToCategoryKey(pill.slug);
      if (!uiKey || seen.has(uiKey)) continue;
      seen.add(uiKey);
      result.push({ key: uiKey, label: pill.name });
    }

    return result;
  }, [categoryPills]);

  const handleCategoryClick = useCallback(
    (categoryId: number | null) => {
      const pill = categoryPills.find((p) => p.id === categoryId);
      if (pill && pill.id !== null && !pill.hasSignals) {
        return;
      }
      setCurrentPage(1);
      if (categoryId === null) {
        setSelectedCategoryIds([]);
      } else {
        setSelectedCategoryIds((prev) =>
          prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
        );
      }
    },
    [categoryPills],
  );

  const centerTitle = `${t("nav.digest")} · ${digestSubtitleFromParam(filterDate, t("digest.today"), locale)}`;

  const toggleTopicTag = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const goPrevDay = () => {
    const next = shiftDateYmd(filterDate, -1);
    setCurrentPage(1);
    setFilterDate(next);
    navigate(`/digest/${next}`);
  };

  const goNextDay = () => {
    const next = shiftDateYmd(filterDate, 1);
    setCurrentPage(1);
    setFilterDate(next);
    navigate(`/digest/${next}`);
  };

  const goToday = () => {
    const t = todayYmd();
    setCurrentPage(1);
    setFilterDate(t);
    navigate(`/digest/${t}`);
  };

  const showUpgradeCta = error?.includes("Mon/Wed/Fri") || error?.includes("daily access");
  const showMySourcesToggle = subscriptionCount > 0 && (userPlan === "pro" || userPlan === "power");

  return (
    <div className="min-h-screen bg-white">
      {isMobile && (
        <header className="sticky top-0 z-20 border-b border-[#eff3f4] bg-white/85 px-4 py-3 backdrop-blur-[12px]">
          <div className="flex items-center justify-between gap-2">
            <Zap className="h-6 w-6 shrink-0 text-[#1d9bf0]" aria-hidden />
            <h1 className="flex-1 truncate text-center text-base font-extrabold text-[#0f1419]">{centerTitle}</h1>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-full p-2 text-[#536471] hover:bg-[#f7f9f9]"
              aria-label={t("digest.filterSignals")}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevDay}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#eff3f4] text-[#536471]"
              aria-label={t("digest.previousDay")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <input
              type="date"
              lang={locale === "vi" ? "vi-VN" : "en-US"}
              value={filterDate}
              max={todayYmd()}
              onChange={(event) => {
                const next = event.target.value;
                if (!next) {
                  return;
                }
                setCurrentPage(1);
                setFilterDate(next);
                navigate(`/digest/${next}`);
              }}
              className="h-9 min-w-0 flex-1 rounded-lg border border-[#d7dee3] px-3 text-sm text-[#0f1419]"
              aria-label={t("digest.today")}
            />

            <button
              type="button"
              onClick={goNextDay}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#eff3f4] text-[#536471]"
              aria-label={t("digest.nextDay")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={goToday}
              className="h-9 shrink-0 rounded-full bg-[#1d9bf0] px-3 text-xs font-bold text-white"
            >
              {t("digest.today")}
            </button>
          </div>
        </header>
      )}

      <div className="mx-auto max-w-2xl pb-6">
        {!isMobile && (
          <div className="sticky top-0 z-20 border-b border-[#eff3f4] bg-[rgba(255,255,255,0.85)] backdrop-blur-[12px]">
            <div className="flex items-center justify-between px-5 py-3">
              <h1 className="text-xl font-extrabold text-[#0f1419]">{t("nav.digest")}</h1>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goPrevDay}
                  className="rounded-full border-none bg-transparent px-2 py-1.5 text-[#536471]"
                  aria-label={t("digest.previousDay")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-1 text-sm font-semibold text-[#0f1419]">
                  {digestSubtitleFromParam(filterDate, t("digest.today"), locale)}
                </span>
                <button
                  type="button"
                  onClick={goNextDay}
                  className="rounded-full border-none bg-transparent px-2 py-1.5 text-[#536471]"
                  aria-label={t("digest.nextDay")}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="ml-1 rounded-full border-none bg-[#1d9bf0] px-4 py-1.5 text-[13px] font-bold text-white"
                >
                  {t("digest.today")}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-[10px] px-5 pb-3">
              <div className="category-pills flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categoryPills.map((cat) => {
                  const active =
                    cat.id === null ? selectedCategoryIds.length === 0 : selectedCategoryIds.includes(cat.id);
                  const isDisabled = !cat.hasSignals && cat.id !== null;
                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      disabled={isDisabled}
                      title={
                        isDisabled
                          ? t("digest.noSignalsInCategoryToday").replace("{category}", cat.name)
                          : undefined
                      }
                      onClick={() => handleCategoryClick(cat.id)}
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                        active ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                        isDisabled ? "cursor-not-allowed opacity-40 hover:bg-gray-100" : "cursor-pointer",
                      )}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>

              {showMySourcesToggle && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(1);
                    setMyKolsOnly(!myKolsOnly);
                  }}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-2 rounded-full transition-colors",
                    myKolsOnly
                      ? "border border-[#1d9bf0] bg-[#e8f5fd] text-[#1d9bf0]"
                      : "border border-[#eff3f4] bg-transparent text-[#536471]",
                  )}
                  style={{ padding: "6px 14px", fontSize: 14, fontWeight: 600 }}
                >
                  <span
                    className={cn(
                      "relative h-4 w-[30px] shrink-0 rounded-full transition-colors",
                      myKolsOnly ? "bg-[#1d9bf0]" : "bg-[#cfd9de]",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                        myKolsOnly ? "left-4" : "left-0.5",
                      )}
                    />
                  </span>
                  <span className="whitespace-nowrap">{t("digest.myKolsOnly")}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap" style={{ gap: 6, padding: "0 20px 8px" }}>
              {topicTagsForHeader.map((tag) => {
                const active = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setCurrentPage(1);
                      toggleTopicTag(tag);
                    }}
                    className="cursor-pointer border-none bg-transparent p-0 text-[13px] leading-none"
                    style={{
                      color: active ? "#1d9bf0" : "#536471",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="px-5 pb-2.5 text-[13px] text-[#536471]">
              {signalCount} {t("digest.signalsCount")}
            </div>
          </div>
        )}

        <div className="px-0 pt-0 md:px-0">
          {newSignalsCount > 0 && (
            <div className="px-4 pt-4 md:px-5">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#cfe8ff] bg-[#eef7ff] px-4 py-3">
                <span className="text-sm font-medium text-[#0f1419]">
                  {t("digest.newSignalsAvailable").replace("{count}", String(newSignalsCount))}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void loadSignals();
                    setNewSignalsCount(0);
                  }}
                  className="shrink-0 rounded-full bg-[#1d9bf0] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {t("digest.loadNewSignals")}
                </button>
              </div>
            </div>
          )}

          {userPlan !== "free" && myKolsOnly && (
            <MySourcesStatsBar signalCount={signalCount} topHandles={myKolsTopHandles} loading={loading} />
          )}

          {loading && (
            <div className="grid gap-3 px-4 py-6 md:px-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-lg bg-[#eff3f4]" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6">
              <p className="font-medium text-red-800">{error}</p>
              {error === t("digest.authRequired") && (
                <a href="/login" className="mt-4 inline-block rounded-full bg-[#0f1419] px-4 py-2 text-sm font-bold text-white no-underline">
                  {t("digest.signIn")}
                </a>
              )}
              {showUpgradeCta && (
                <div className="mt-4">
                  <a
                    href="/settings?tab=billing"
                    className="inline-block rounded-md bg-[#1d9bf0] px-4 py-2 text-sm font-bold text-white no-underline hover:bg-[#1a8cd8]"
                  >
                    {t("digest.upgradeToPro")}
                  </a>
                </div>
              )}
            </div>
          )}

          {!loading && !error && (
            <>
              {visibleSignals.length === 0 ? (
                <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-[#eff3f4] bg-[#f7f9f9] p-8 text-center">
                  {myKolsOnly ? (
                    <>
                      <p className="text-[#536471]">{t("digest.noSignalsFromMyKols")}</p>
                      <button
                        type="button"
                        onClick={() => setMyKolsOnly(false)}
                        className="mt-3 rounded-full bg-[#0f1419] px-4 py-2 text-sm font-semibold text-white"
                      >
                        {t("digest.viewAllSources")}
                      </button>
                    </>
                  ) : (
                    <p className="text-[#536471]">{t("digest.noSignalsForDate")}</p>
                  )}
                </div>
              ) : (
                <div className="border-t border-[#eff3f4]">
                  {visibleSignals.map((signal) => (
                    <DigestSignalCard
                      key={signal.id}
                      signal={signal}
                      onClick={() => {
                        setSelectedSignalId(Number(signal.id));
                        setSelectedListRank(signal.rank);
                        setIsDetailModalOpen(true);
                      }}
                      myKolsOnly={myKolsOnly}
                      userPlan={userPlan}
                      isArchived={archivedIds.has(Number(signal.id))}
                      archiveLoading={archiveLoadingIds.has(Number(signal.id))}
                      onArchiveToggle={handleArchiveToggle}
                    />
                  ))}
                </div>
              )}

              {!loading && lastPage > 1 && !clientTagFiltered && (
                <div className="flex items-center justify-center gap-4 py-6">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="rounded-full border border-[#eff3f4] px-4 py-2 text-sm font-semibold text-[#0f1419] disabled:opacity-40"
                  >
                    {t("digest.previous")}
                  </button>
                  <span className="text-sm text-[#536471]">
                    {t("digest.page")} {currentPage} / {lastPage}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= lastPage}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="rounded-full border border-[#eff3f4] px-4 py-2 text-sm font-semibold text-[#0f1419] disabled:opacity-40"
                  >
                    {t("digest.next")}
                  </button>
                </div>
              )}
            </>
          )}

          <PipelineFooter />
        </div>
      </div>

      {isMobile && (
        <>
          <FilterSheet
            open={filterSheetOpen}
            onClose={() => setFilterSheetOpen(false)}
            activeCategory={activeCategory}
            onCategoryChange={selectCategory}
            activeTags={activeTags}
            onTagChange={setActiveTags}
            mySourcesOnly={myKolsOnly}
            onMySourcesChange={setMyKolsOnly}
            userPlan={userPlan}
            showMySourcesToggle={showMySourcesToggle}
            topicTagOptions={topicTagsForHeader}
            categoryOptions={mobileCategoryOptions}
          />
        </>
      )}

      <SignalDetailModal
        signalId={selectedSignalId}
        listRank={selectedListRank}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedSignalId(null);
          setSelectedListRank(null);
          const qp = new URLSearchParams(location.search);
          if (qp.has("signal_id")) {
            qp.delete("signal_id");
            const next = qp.toString();
            navigate({ pathname: location.pathname, search: next ? `?${next}` : "" }, { replace: true });
          }
        }}
        userPlan={userPlan}
      />
    </div>
  );
};

export default DigestPage;
