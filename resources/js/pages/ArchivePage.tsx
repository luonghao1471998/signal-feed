import React, { useEffect, useMemo, useState } from "react";
import { Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ArchiveSignalCard, { type ArchiveSignalCardItem } from "./archive/ArchiveSignalCard";
import { xFilterPillActive, xFilterPillInactive } from "@/lib/xStyles";
import { toast } from "sonner";
import {
  fetchArchivedSignals,
  fetchCategories,
  unarchiveSignal,
  type ApiCategory,
  type ArchiveResponse,
  type ArchivedSignalApi,
} from "@/services/signalService";
import { useLocale } from "@/i18n";

type DateRangeFilter = "today" | "yesterday" | "last7" | "last30";

function formatDateGroupHeader(groupKey: string, todayLabel: string, yesterdayLabel: string, datePrefix: string): string {
  const d = new Date(`${groupKey}T00:00:00`);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  const yesterdayKey = y.toISOString().slice(0, 10);
  const prefix = groupKey === todayKey ? todayLabel : groupKey === yesterdayKey ? yesterdayLabel : datePrefix;
  const formatted = Number.isNaN(d.getTime())
    ? groupKey
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${prefix} — ${formatted}`;
}

function toTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = Math.max(0, Date.now() - t);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapArchivedSignalToCard(
  item: ArchivedSignalApi,
  rank: number,
  categoriesLookup: Map<number, string>,
): ArchiveSignalCardItem {
  const categoryNames = (item.categories ?? [])
    .map((c) => {
      if (typeof c === "number") {
        return categoriesLookup.get(c) ?? `Category ${c}`;
      }
      if (c && typeof c === "object" && typeof c.name === "string") {
        return c.name;
      }
      return null;
    })
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");

  const tags = Array.isArray(item.topic_tags)
    ? item.topic_tags
        .filter((t): t is string => typeof t === "string" && t.trim() !== "")
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
    : [];

  const stackSources = (item.sources ?? []).slice(0, 8).map((source) => ({
    handle: source.handle,
    name: source.display_name || source.handle,
    avatar: source.avatar_url ?? "",
  }));

  return {
    id: item.id,
    rank,
    title: item.title,
    categories: categoryNames,
    tags,
    summary: item.summary,
    kolCount: item.source_count,
    timeAgo: toTimeAgo(item.archived_at),
    // Archive list API chưa trả sources chi tiết; dùng placeholder stack theo source_count.
    stackSources,
    openUrl: item.date ? `/digest/${item.date}?signal_id=${item.id}` : `/digest?signal_id=${item.id}`,
  };
}

const ArchivePage: React.FC = () => {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("last30");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [archivedSignals, setArchivedSignals] = useState<ArchivedSignalApi[]>([]);
  const [meta, setMeta] = useState<ArchiveResponse["meta"] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsaveLoadingIds, setUnsaveLoadingIds] = useState<Set<number>>(new Set());
  const [reloadTick, setReloadTick] = useState(0);
  const categoryPills = useMemo(
    () => [{ id: null as number | null, label: t("archive.all") }, ...apiCategories.map((c) => ({ id: c.id, label: c.name }))],
    [apiCategories, t],
  );
  const datePills: { id: DateRangeFilter; label: string }[] = [
    { id: "today", label: t("archive.today") },
    { id: "yesterday", label: t("archive.yesterday") },
    { id: "last7", label: t("archive.last7Days") },
    { id: "last30", label: t("archive.last30Days") },
  ];

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

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, selectedCategoryId, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchArchivedSignals({
          date_range: dateRange,
          category_id: selectedCategoryId ? [selectedCategoryId] : undefined,
          search: searchQuery.trim() || undefined,
          page: currentPage,
          per_page: 20,
        });
        if (cancelled) {
          return;
        }
        setMeta(response.meta);
        setArchivedSignals((prev) => (currentPage === 1 ? response.data : [...prev, ...response.data]));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("archive.failedToLoad"));
          if (currentPage === 1) {
            setArchivedSignals([]);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateRange, selectedCategoryId, searchQuery, currentPage, reloadTick]);

  const groupedSignals = useMemo(() => {
    const categoriesLookup = new Map(apiCategories.map((c) => [c.id, c.name]));
    const groups = new Map<string, ArchiveSignalCardItem[]>();
    archivedSignals.forEach((item, idx) => {
      const dateKey = item.archived_at.slice(0, 10);
      const rank = idx + 1;
      const mapped = mapArchivedSignalToCard(item, rank, categoriesLookup);
      const existing = groups.get(dateKey) ?? [];
      existing.push(mapped);
      groups.set(dateKey, existing);
    });
    return Array.from(groups.entries()).map(([date, signals]) => ({ date, signals }));
  }, [archivedSignals, apiCategories]);

  const isFilterActive = dateRange !== "last30" || selectedCategoryId !== null || searchQuery.trim() !== "";
  const isEmpty = !loading && !error && groupedSignals.length === 0;

  const clearFilters = () => {
    setSearchQuery("");
    setDateRange("last30");
    setSelectedCategoryId(null);
  };

  const handleUnsave = async (id: number) => {
    if (unsaveLoadingIds.has(id)) {
      return;
    }
    const previous = archivedSignals;
    setArchivedSignals((prev) => prev.filter((s) => s.id !== id));
    setUnsaveLoadingIds((prev) => new Set(prev).add(id));
    try {
      await unarchiveSignal(id);
      toast.success(t("digest.archiveRemoved"));
      setMeta((prev) =>
        prev
          ? {
              ...prev,
              total: Math.max(0, prev.total - 1),
            }
          : prev,
      );
    } catch {
      setArchivedSignals(previous);
      toast.error(t("digest.archiveFailed"));
    } finally {
      setUnsaveLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-none px-4 py-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-0">
            <h1 className="text-xl font-bold text-slate-900">{t("nav.archive")}</h1>
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("archive.searchPlaceholder")}
              className="rounded-full w-64 max-w-full bg-[#EFF3F4] border-none placeholder:text-slate-400 focus-visible:bg-white focus-visible:border focus-visible:border-blue-400 focus-visible:ring-0"
            />
          </header>

          <div className="border-b border-slate-100 py-2 px-4 -mx-4 mt-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {datePills.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDateRange(p.id)}
                  className={dateRange === p.id ? xFilterPillActive : xFilterPillInactive}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categoryPills.map((p) => (
                <button
                  key={String(p.id)}
                  type="button"
                  onClick={() => setSelectedCategoryId(p.id)}
                  className={selectedCategoryId === p.id ? xFilterPillActive : xFilterPillInactive}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 -mx-4 border-t border-slate-100">
            {loading && archivedSignals.length === 0 ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-lg bg-[#eff3f4]" />
                ))}
              </div>
            ) : null}

            {!loading && error ? (
              <div className="flex flex-col items-center py-12 text-center px-4">
                <p className="text-slate-900 font-bold">{t("archive.failedToLoad")}</p>
                <Button
                  variant="outline"
                  className="rounded-full mt-4 border-slate-300 text-slate-900 font-bold hover:bg-slate-50"
                  type="button"
                  onClick={() => {
                    setCurrentPage(1);
                    setReloadTick((x) => x + 1);
                  }}
                >
                  {t("archive.retry")}
                </Button>
              </div>
            ) : null}

            {isEmpty ? (
              <div className="flex flex-col items-center py-16 text-center px-4">
                <Archive className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.25} />
                {isFilterActive ? (
                  <>
                    <p className="text-slate-900 font-bold">{t("archive.noSignalsMatchFilters")}</p>
                    <p className="text-sm text-slate-400 mt-1">{t("archive.adjustFilters")}</p>
                    <Button
                      variant="outline"
                      className="rounded-full mt-4 border-slate-300 text-slate-900 font-bold hover:bg-slate-50"
                      type="button"
                      onClick={clearFilters}
                    >
                      {t("archive.clearFilters")}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-slate-900 font-bold">{t("archive.empty")}</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {t("archive.emptyHint")}
                    </p>
                  </>
                )}
              </div>
            ) : (
              groupedSignals.map((group) => (
                <section key={group.date}>
                  <p className="text-xs text-slate-400 font-medium uppercase py-2 px-4">
                    {formatDateGroupHeader(group.date, t("archive.today"), t("archive.yesterday"), t("archive.datePrefix"))}
                  </p>
                  <div className="border-t border-slate-100">
                    {group.signals.map((signal) => (
                      <ArchiveSignalCard
                        key={signal.id}
                        signal={signal}
                        onUnsave={handleUnsave}
                        unsaveLoading={unsaveLoadingIds.has(signal.id)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}

            {!error && meta && currentPage < meta.last_page ? (
              <div className="flex justify-center px-4 py-6">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-slate-300 text-slate-900 font-bold hover:bg-slate-50"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={loading}
                >
                  {loading ? t("archive.loading") : t("archive.loadMore")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
    </div>
  );
};

export default ArchivePage;
