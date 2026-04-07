import React, { useMemo, useState } from "react";
import { Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ArchiveSignalCard from "./archive/ArchiveSignalCard";
import { archivedSignals } from "./archive/archivedSignals";
import { ARCHIVE_FILTER_CATEGORIES, useCategoryFilter } from "@/contexts/CategoryFilterContext";
import { xFilterPillActive, xFilterPillInactive } from "@/lib/xStyles";
import { type ArchiveCategoryFilter, signalMatchesCategoryFilter } from "./archive/categoryFilter";

type DateRangeFilter = "today" | "yesterday" | "last7" | "last30";

const REF_TODAY = new Date(2026, 2, 31);

const datePills: { id: DateRangeFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
];

function groupMatchesDateRange(groupDate: "today" | "yesterday", range: DateRangeFilter): boolean {
  if (range === "today") return groupDate === "today";
  if (range === "yesterday") return groupDate === "yesterday";
  return true;
}

function formatDateGroupHeader(groupDate: "today" | "yesterday"): string {
  const d =
    groupDate === "today"
      ? REF_TODAY
      : new Date(REF_TODAY.getFullYear(), REF_TODAY.getMonth(), REF_TODAY.getDate() - 1);
  const label = groupDate === "today" ? "Today" : "Yesterday";
  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${label} — ${formatted}`;
}

function matchesSearch(query: string, title: string, summary: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return title.toLowerCase().includes(q) || summary.toLowerCase().includes(q);
}

const ArchivePage: React.FC = () => {
  const { activeCategory, setCategory } = useCategoryFilter();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("last30");
  const categoryFilter = activeCategory as ArchiveCategoryFilter;

  const filteredGroups = useMemo(() => {
    return archivedSignals
      .filter((g) => groupMatchesDateRange(g.date, dateRange))
      .map((g) => ({
        ...g,
        signals: g.signals.filter(
          (s) =>
            matchesSearch(searchQuery, s.title, s.summary) &&
            signalMatchesCategoryFilter(s.categories, categoryFilter),
        ),
      }))
      .filter((g) => g.signals.length > 0);
  }, [searchQuery, dateRange, categoryFilter]);

  const isEmpty = filteredGroups.length === 0;

  const clearFilters = () => {
    setSearchQuery("");
    setDateRange("last30");
    setCategory("all");
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-none px-4 py-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-0">
            <h1 className="text-xl font-bold text-slate-900">Archive</h1>
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived signals..."
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
              {ARCHIVE_FILTER_CATEGORIES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setCategory(p.key)}
                  className={categoryFilter === p.key ? xFilterPillActive : xFilterPillInactive}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 -mx-4 border-t border-slate-100">
            {isEmpty ? (
              <div className="flex flex-col items-center py-16 text-center px-4">
                <Archive className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.25} />
                <p className="text-slate-900 font-bold">No archived signals found</p>
                <p className="text-sm text-slate-400 mt-1">Try adjusting your search or filters</p>
                <Button
                  variant="outline"
                  className="rounded-full mt-4 border-slate-300 text-slate-900 font-bold hover:bg-slate-50"
                  type="button"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <section key={group.date}>
                  <p className="text-xs text-slate-400 font-medium uppercase py-2 px-4">
                    {formatDateGroupHeader(group.date)}
                  </p>
                  <div className="border-t border-slate-100">
                    {group.signals.map((signal) => (
                      <ArchiveSignalCard key={signal.id} signal={signal} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
    </div>
  );
};

export default ArchivePage;
