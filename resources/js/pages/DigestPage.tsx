import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Zap } from "lucide-react";
import DigestSignalCard from "../components/DigestSignalCard";
import PipelineFooter from "../components/PipelineFooter";
import MySourcesStatsBar from "../components/MySourcesStatsBar";
import SignalBottomSheet from "../components/SignalBottomSheet";
import FilterSheet from "../components/FilterSheet";
import { useCategoryFilter } from "@/contexts/CategoryFilterContext";
import { DIGEST_FILTER_CATEGORIES, type CategoryFilterKey } from "@/contexts/CategoryFilterContext";
import { type CategoryKey } from "@/components/CategoryBadge";
import { digestSignals, type DigestSignal } from "../data/digestSignals";
import { DIGEST_TOPIC_TAGS } from "../data/digestTopicTags";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const DIGEST_HEADER_KEYS = new Set<CategoryFilterKey>([
  "all",
  "ai-ml",
  "dev-tools",
  "marketing",
  "startup-vc",
  "crypto",
]);

const headerCategories = DIGEST_FILTER_CATEGORIES.filter((c) => DIGEST_HEADER_KEYS.has(c.key));

/** Mock “following” handles for My KOLs expanded-card badges and left border. */
const MOCK_FOLLOWING_HANDLES = new Set(["@sama", "@karpathy", "@levelsio", "@rauchg", "@emollick"]);

function signalHasFollowingKol(signal: DigestSignal): boolean {
  return signal.sources.some((s) => MOCK_FOLLOWING_HANDLES.has(s.handle));
}

function pillLabel(key: CategoryFilterKey, fallback: string): string {
  if (key === "ai-ml") return "AI / ML";
  if (key === "dev-tools") return "Dev Tools";
  if (key === "marketing") return "Marketing";
  if (key === "startup-vc") return "Startup/VC";
  if (key === "crypto") return "Crypto";
  if (key === "all") return "All";
  return fallback;
}

function digestSubtitleFromParam(dateParam?: string): string {
  if (!dateParam) return "Mar 31, 2026";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
  if (!m) return dateParam;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const DigestPage: React.FC = () => {
  const { date: dateParam } = useParams<{ date?: string }>();
  const [myKolsOnly, setMyKolsOnly] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<DigestSignal | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { activeCategory, selectCategory } = useCategoryFilter();

  useEffect(() => {
    setActiveTags([]);
  }, [activeCategory]);

  const centerTitle = `Digest · ${digestSubtitleFromParam(dateParam)}`;

  const toggleTopicTag = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const visibleSignals = useMemo(() => {
    let list = digestSignals;
    if (activeCategory !== "all") {
      list = list.filter((s) => s.categories.includes(activeCategory as CategoryKey));
    }
    if (activeTags.length > 0) {
      list = list.filter((s) => activeTags.some((t) => s.tags.includes(t)));
    }
    return list;
  }, [activeCategory, activeTags]);

  const signalCount = visibleSignals.length;

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
                  className="rounded-full border-none bg-transparent px-2 py-1.5 text-[#536471]"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-1 text-sm font-semibold text-[#0f1419]">{digestSubtitleFromParam(dateParam)}</span>
                <button
                  type="button"
                  className="rounded-full border-none bg-transparent px-2 py-1.5 text-[#536471]"
                  aria-label="Next day"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="ml-1 rounded-full border-none bg-[#1d9bf0] px-4 py-1.5 text-[13px] font-bold text-white"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-[10px] px-5 pb-3">
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {headerCategories.map((cat) => {
                  const active = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => selectCategory(cat.key)}
                      className={cn(
                        "shrink-0 cursor-pointer rounded-full px-4 py-1.5 text-sm",
                        active
                          ? "border-none bg-[#0f1419] font-bold text-white"
                          : "border border-[#eff3f4] bg-transparent font-medium text-[#536471]",
                      )}
                    >
                      {pillLabel(cat.key, cat.label)}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setMyKolsOnly(!myKolsOnly)}
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
            </div>

            <div className="flex flex-wrap" style={{ gap: 6, padding: "0 20px 8px" }}>
              {DIGEST_TOPIC_TAGS.map((tag) => {
                const active = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTopicTag(tag)}
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
              {signalCount} signals
            </div>
          </div>
        )}

        <div className="px-0 pt-0 md:px-0">
          {myKolsOnly && <MySourcesStatsBar />}

          <div className="border-t border-[#eff3f4]">
            {visibleSignals.map((signal) => (
              <DigestSignalCard
                key={signal.id}
                signal={signal}
                sheetMode={isMobile}
                onSignalOpen={setSelectedSignal}
                myKolsOnly={myKolsOnly}
                followingHandles={MOCK_FOLLOWING_HANDLES}
                signalHasMyKolMatch={signalHasFollowingKol(signal)}
              />
            ))}
          </div>

          <PipelineFooter />
        </div>
      </div>

      {isMobile && (
        <>
          <SignalBottomSheet signal={selectedSignal} onDismiss={() => setSelectedSignal(null)} />
          <FilterSheet
            open={filterSheetOpen}
            onClose={() => setFilterSheetOpen(false)}
            activeCategory={activeCategory}
            onCategoryChange={selectCategory}
            activeTags={activeTags}
            onTagChange={setActiveTags}
            mySourcesOnly={myKolsOnly}
            onMySourcesChange={setMyKolsOnly}
          />
        </>
      )}
    </div>
  );
};

export default DigestPage;
