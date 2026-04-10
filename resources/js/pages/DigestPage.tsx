import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Zap } from "lucide-react";
import DigestSignalCard from "../components/DigestSignalCard";
import PipelineFooter from "../components/PipelineFooter";
import MySourcesStatsBar from "../components/MySourcesStatsBar";
import SignalBottomSheet from "../components/SignalBottomSheet";
import FilterSheet from "../components/FilterSheet";
import { useCategoryFilter } from "@/contexts/CategoryFilterContext";
import type { CategoryFilterKey } from "@/contexts/CategoryFilterContext";
import { DIGEST_TOPIC_TAGS } from "../data/digestTopicTags";
import { ALL_CATEGORIES } from "@/constants/categories";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useDigestSidebarOptional } from "@/contexts/DigestSidebarContext";
import { fetchCategories, fetchSignals, type ApiCategory } from "@/services/signalService";
import { mapApiSignalToDigest } from "@/lib/mapApiSignalToDigest";
import { categoryFilterKeyToDbSlug } from "@/lib/categorySlugMap";
import type { DigestSignal } from "@/types/digestUi";

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

function digestSubtitleFromParam(dateParam?: string): string {
  if (!dateParam) return "Today";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
  if (!m) return dateParam;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const { date: dateParam } = useParams<{ date?: string }>();
  const { user, token, authReady } = useAuth();
  const userPlan = user?.plan ?? "free";

  const [filterDate, setFilterDate] = useState(() => dateParam ?? todayYmd());
  const [myKolsOnly, setMyKolsOnly] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<DigestSignal | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [rawSignals, setRawSignals] = useState<DigestSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

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
    if (userPlan === "free" && myKolsOnly) {
      setMyKolsOnly(false);
    }
  }, [userPlan, myKolsOnly]);

  useEffect(() => {
    setActiveTags([]);
    setSelectedCategoryIds([]);
  }, [filterDate]);

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

      const mySourcesOnly = userPlan !== "free" && myKolsOnly;
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
      setError(e instanceof Error ? e.message : "Failed to load signals");
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

  useEffect(() => {
    if (!authReady) {
      return;
    }
    if (!user && !token) {
      setLoading(false);
      setError("Authentication required. Please sign in.");
      setRawSignals([]);
      return;
    }
    void loadSignals();
  }, [loadSignals, authReady, user, token]);

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

    const byHandle = new Map<string, { displayName: string; signalIds: Set<string> }>();
    rawSignals.forEach((sig) => {
      sig.sources.forEach((src) => {
        const h = src.handle;
        if (!byHandle.has(h)) {
          byHandle.set(h, { displayName: src.name, signalIds: new Set() });
        }
        byHandle.get(h)!.signalIds.add(sig.id);
      });
    });

    const topKols = Array.from(byHandle.entries())
      .map(([handle, v]) => ({
        handle,
        displayName: v.displayName,
        signalCount: v.signalIds.size,
      }))
      .sort((a, b) => b.signalCount - a.signalCount)
      .slice(0, 10);

    digestSidebar.setSnapshot({
      signalTotal: total,
      kolsActive: handleSet.size,
      topicTags: Array.from(new Set(rawSignals.flatMap((s) => s.tags))).slice(0, 6),
      topKols,
      loading,
    });
  }, [digestSidebar, rawSignals, total, loading]);

  useEffect(() => {
    return () => {
      digestSidebar?.setSnapshot(null);
    };
  }, [digestSidebar]);

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

  const categoryPills = useMemo((): CategoryPill[] => {
    const signals = rawSignals;
    const activeCategoryIds = new Set(signals.flatMap((s) => s.categoryIds));

    const myCats = user?.my_categories ?? [];
    if (myCats.length > 0) {
      return [
        {
          id: null,
          name: "All",
          slug: "all",
          hasSignals: signals.length > 0,
        },
        ...ALL_CATEGORIES.filter((cat) => myCats.includes(cat.id)).map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          hasSignals: activeCategoryIds.has(cat.id),
        })),
      ];
    }

    if (signals.length > 0 && activeCategoryIds.size > 0) {
      const rest = ALL_CATEGORIES.filter((cat) => activeCategoryIds.has(cat.id))
        .map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          hasSignals: true,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return [{ id: null, name: "All", slug: "all", hasSignals: true }, ...rest];
    }

    return [
      { id: null, name: "All", slug: "all", hasSignals: false },
      ...ALL_CATEGORIES.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        hasSignals: false,
      })),
    ];
  }, [rawSignals, user?.my_categories]);

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

  const centerTitle = `Digest · ${digestSubtitleFromParam(filterDate)}`;

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

  return (
    <div className="min-h-screen bg-white">
      {isMobile && (
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-[#eff3f4] bg-white/85 px-4 py-3 backdrop-blur-[12px]">
          <Zap className="h-6 w-6 shrink-0 text-[#1d9bf0]" aria-hidden />
          <h1 className="flex-1 truncate text-center text-base font-extrabold text-[#0f1419]">{centerTitle}</h1>
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-full p-2 text-[#536471] hover:bg-[#f7f9f9]"
            aria-label="Filter signals"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </header>
      )}

      <div className="mx-auto max-w-2xl pb-6">
        {!isMobile && (
          <div className="sticky top-0 z-20 border-b border-[#eff3f4] bg-[rgba(255,255,255,0.85)] backdrop-blur-[12px]">
            <div className="flex items-center justify-between px-5 py-3">
              <h1 className="text-xl font-extrabold text-[#0f1419]">Digest</h1>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goPrevDay}
                  className="rounded-full border-none bg-transparent px-2 py-1.5 text-[#536471]"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-1 text-sm font-semibold text-[#0f1419]">{digestSubtitleFromParam(filterDate)}</span>
                <button
                  type="button"
                  onClick={goNextDay}
                  className="rounded-full border-none bg-transparent px-2 py-1.5 text-[#536471]"
                  aria-label="Next day"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="ml-1 rounded-full border-none bg-[#1d9bf0] px-4 py-1.5 text-[13px] font-bold text-white"
                >
                  Today
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
                      title={isDisabled ? `No signals in ${cat.name} today` : undefined}
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

              {userPlan !== "free" && (
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
                  <span className="whitespace-nowrap">My KOLs only</span>
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

            <div className="px-5 pb-2.5 text-[13px] text-[#536471]">{signalCount} signals</div>
          </div>
        )}

        <div className="px-0 pt-0 md:px-0">
          {userPlan !== "free" && myKolsOnly && <MySourcesStatsBar />}

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
              {error.includes("Authentication required") && (
                <a href="/login" className="mt-4 inline-block rounded-full bg-[#0f1419] px-4 py-2 text-sm font-bold text-white no-underline">
                  Sign in
                </a>
              )}
              {showUpgradeCta && (
                <div className="mt-4">
                  <a
                    href="/settings"
                    className="inline-block rounded-md bg-[#1d9bf0] px-4 py-2 text-sm font-bold text-white no-underline hover:bg-[#1a8cd8]"
                  >
                    Upgrade to Pro for Daily Access
                  </a>
                </div>
              )}
            </div>
          )}

          {!loading && !error && (
            <>
              {visibleSignals.length === 0 ? (
                <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-[#eff3f4] bg-[#f7f9f9] p-8 text-center">
                  <p className="text-[#536471]">No signals found for this date</p>
                </div>
              ) : (
                <div className="border-t border-[#eff3f4]">
                  {visibleSignals.map((signal) => (
                    <DigestSignalCard
                      key={signal.id}
                      signal={signal}
                      sheetMode={isMobile}
                      onSignalOpen={setSelectedSignal}
                      myKolsOnly={myKolsOnly}
                      userPlan={userPlan}
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
                    Previous
                  </button>
                  <span className="text-sm text-[#536471]">
                    Page {currentPage} / {lastPage}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= lastPage}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="rounded-full border border-[#eff3f4] px-4 py-2 text-sm font-semibold text-[#0f1419] disabled:opacity-40"
                  >
                    Next
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
          <SignalBottomSheet
            signal={selectedSignal}
            onDismiss={() => setSelectedSignal(null)}
            userPlan={userPlan}
          />
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
            topicTagOptions={topicTagsForHeader}
          />
        </>
      )}
    </div>
  );
};

export default DigestPage;
