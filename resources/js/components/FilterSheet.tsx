import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DIGEST_FILTER_CATEGORIES, type CategoryFilterKey } from "@/contexts/CategoryFilterContext";
import { Switch } from "@/components/ui/switch";
import { DIGEST_TOPIC_TAGS } from "@/data/digestTopicTags";

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  activeCategory: CategoryFilterKey;
  onCategoryChange: (cat: CategoryFilterKey) => void;
  activeTags: string[];
  onTagChange: (tags: string[]) => void;
  mySourcesOnly: boolean;
  onMySourcesChange: (val: boolean) => void;
}

const FilterSheet: React.FC<FilterSheetProps> = ({
  open,
  onClose,
  activeCategory,
  onCategoryChange,
  activeTags,
  onTagChange,
  mySourcesOnly,
  onMySourcesChange,
}) => {
  const [localCat, setLocalCat] = useState(activeCategory);
  const [localTags, setLocalTags] = useState<string[]>(activeTags);
  const [localMySources, setLocalMySources] = useState(mySourcesOnly);
  const prevOpen = useRef(open);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setLocalCat(activeCategory);
      setLocalTags([...activeTags]);
      setLocalMySources(mySourcesOnly);
    }
    prevOpen.current = open;
  }, [open, activeCategory, activeTags, mySourcesOnly]);

  if (!open) return null;

  const resetAll = () => {
    setLocalCat("all");
    setLocalTags([]);
    setLocalMySources(false);
  };

  const apply = () => {
    onCategoryChange(localCat);
    onTagChange(localTags);
    onMySourcesChange(localMySources);
    onClose();
  };

  const toggleTag = (tag: string) => {
    setLocalTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/20" onClick={onClose} aria-hidden />

      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl max-h-[80vh] flex flex-col shadow-xl min-h-0">
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        <div className="px-4 flex items-center gap-2 pb-3 shrink-0">
          <h2 className="font-bold text-slate-900">Filter signals</h2>
          <button type="button" onClick={resetAll} className="text-sm text-blue-500 ml-auto font-medium">
            Reset
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 min-h-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Category</p>
          <div className="grid grid-cols-3 gap-2">
            {DIGEST_FILTER_CATEGORIES.map((cat) => {
              const active = localCat === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setLocalCat(cat.key)}
                  className={cn(
                    "rounded-full py-2 px-2 text-xs font-medium text-center min-h-[40px]",
                    active ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 bg-white",
                  )}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-4 mb-2">Topic Tags</p>
          <div className="flex flex-wrap gap-2">
            {DIGEST_TOPIC_TAGS.map((tag) => {
              const active = localTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium",
                    active ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 bg-white",
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-4 py-2">
            <span className="text-sm text-slate-700">My KOLs only</span>
            <Switch checked={localMySources} onCheckedChange={setLocalMySources} />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 p-4 bg-white flex gap-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={resetAll}
            className="flex-1 mr-2 border border-slate-200 rounded-full py-3 text-sm font-medium text-slate-700 bg-white"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={apply}
            className="flex-1 bg-slate-900 text-white rounded-full py-3 text-sm font-bold"
          >
            Apply filters
          </button>
        </div>
      </div>
    </>
  );
};

export default FilterSheet;
