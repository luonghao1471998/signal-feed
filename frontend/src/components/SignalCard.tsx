import React from "react";
import { Bookmark, ExternalLink } from "lucide-react";
import CategoryBadge from "./CategoryBadge";
import { type SignalItem } from "../data/mockSignals";

const rankDot: Record<string, string> = {
  high: "bg-rank-high",
  mid: "bg-rank-mid",
  low: "bg-rank-low",
};

interface SignalCardProps {
  signal: SignalItem;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal }) => {
  return (
    <article className="group bg-card border border-border rounded-2xl p-4 hover:shadow-sm transition-default cursor-pointer">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${rankDot[signal.rank]}`} />
            <span className="text-xs text-muted-foreground font-medium truncate">{signal.source}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{signal.timeAgo}</span>
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-snug mb-1.5 group-hover:text-primary transition-default">
            {signal.title}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">
            {signal.summary}
          </p>
          <CategoryBadge category={signal.category} />
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button className="p-1.5 rounded-lg hover:bg-secondary transition-default min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Bookmark">
            <Bookmark className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-secondary transition-default min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Open link">
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </article>
  );
};

export default SignalCard;
