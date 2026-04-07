import React from "react";
import { cn } from "@/lib/utils";
import { DIGEST_FILTER_CATEGORIES, useCategoryFilter } from "@/contexts/CategoryFilterContext";
import { xFilterPillActive, xFilterPillInactive } from "@/lib/xStyles";

const topicTags = ["#model-release", "#tool-launch", "#market-data"];

interface DigestFilterBarProps {
  mySourcesOnly?: boolean;
  onMySourcesToggle?: (val: boolean) => void;
}

const DigestFilterBar: React.FC<DigestFilterBarProps> = ({ mySourcesOnly = false, onMySourcesToggle }) => {
  const { activeCategory, setCategory } = useCategoryFilter();

  return (
    <div className="border-b border-slate-100 py-2 mb-0">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {DIGEST_FILTER_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setCategory(cat.key)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap",
              activeCategory === cat.key ? xFilterPillActive : xFilterPillInactive,
            )}
          >
            {cat.key !== "all" && (
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  activeCategory === cat.key ? "bg-white" : cat.dotColor,
                )}
              />
            )}
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-2">
          {topicTags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-full bg-transparent"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[13px] text-slate-400">My Sources only</span>
          <button
            type="button"
            onClick={() => onMySourcesToggle?.(!mySourcesOnly)}
            className={cn(
              "relative w-9 h-5 rounded-full transition-default",
              mySourcesOnly ? "bg-slate-900" : "bg-slate-200",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-default",
                mySourcesOnly ? "translate-x-4" : "",
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DigestFilterBar;
