import React from "react";
import { Bookmark, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import CategoryBadge from "@/components/CategoryBadge";
import { AvStack } from "@/components/Avatar";
import type { ArchivedSignal } from "./archivedSignals";
import { categoryLabelToBadgeKey } from "./categoryFilter";

interface ArchiveSignalCardProps {
  signal: ArchivedSignal;
}

const ArchiveSignalCard: React.FC<ArchiveSignalCardProps> = ({ signal }) => {
  const rankIsTop = signal.rank <= 3;
  const tagsLine = signal.tags.join("  ");

  return (
    <article className="group cursor-pointer border-b border-[#eff3f4] bg-transparent transition-colors hover:bg-[#f7f9f9]">
      <div className="flex gap-3.5 px-5 py-4">
        <div
          className={cn(
            "mt-px flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold",
            rankIsTop ? "bg-[#1d9bf0] text-white" : "bg-[#eff3f4] text-[#536471]",
          )}
        >
          {signal.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="m-0 flex-1 text-[15px] font-bold leading-[1.4] text-[#0f1419]">{signal.title}</h3>
            <span className="mt-0.5 shrink-0 text-[13px] text-[#536471]">{signal.timeAgo}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {signal.categories.map((cat) => {
              const key = categoryLabelToBadgeKey(cat);
              return key ? (
                <CategoryBadge key={cat} category={key} className="text-[12px] font-bold" />
              ) : (
                <span
                  key={cat}
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-[#536471] bg-[#eff3f4]"
                >
                  {cat}
                </span>
              );
            })}
            {tagsLine ? <span className="text-[13px] text-[#536471]">{tagsLine}</span> : null}
          </div>

          <p className="mb-0 mt-2 line-clamp-2 text-[14px] leading-[1.5] text-[#536471]">{signal.summary}</p>

          <div className="mt-2.5 flex items-center gap-2.5">
            <AvStack sources={signal.stackSources} max={5} />
            <span className="text-[13px] text-[#536471]">{signal.kolCount} KOLs</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            type="button"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full p-1.5 hover:bg-[#eff3f4]"
            aria-label="Bookmarked"
          >
            <Bookmark className="h-4 w-4 fill-[#1d9bf0] text-[#1d9bf0]" />
          </button>
          <button
            type="button"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full p-1.5 hover:bg-[#eff3f4]"
            aria-label="Open link"
          >
            <ExternalLink className="h-4 w-4 text-[#536471]" />
          </button>
        </div>
      </div>
    </article>
  );
};

export default ArchiveSignalCard;
