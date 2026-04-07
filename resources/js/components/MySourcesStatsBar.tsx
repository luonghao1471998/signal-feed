import React from "react";

const MySourcesStatsBar: React.FC = () => {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 my-2 flex items-center gap-3">
      <span>📡</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-emerald-800">12 signals today from My KOLs</p>
        <p className="text-[13px] text-emerald-600 mt-0.5">Top active: @karpathy · @levelsie · @sama</p>
      </div>
      <span className="bg-emerald-100 text-emerald-700 text-xs rounded-full px-2 py-0.5 shrink-0 font-medium">
        ↑ +3 vs yesterday
      </span>
    </div>
  );
};

export default MySourcesStatsBar;
