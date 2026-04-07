import React from "react";
import { cn } from "@/lib/utils";

function getRankStyles(score: number) {
  if (score >= 0.75) {
    return "bg-emerald-100 text-emerald-700 border border-emerald-300";
  }
  if (score >= 0.5) {
    return "bg-amber-100 text-amber-700 border border-amber-300";
  }
  return "bg-slate-100 text-slate-600 border border-slate-200";
}

interface RankBadgeProps {
  score: number;
  rank: number;
  className?: string;
}

const RankBadge: React.FC<RankBadgeProps> = ({ score, rank, className }) => {
  return (
    <div
      className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
        getRankStyles(score),
        className,
      )}
    >
      {rank}
    </div>
  );
};

export default RankBadge;
