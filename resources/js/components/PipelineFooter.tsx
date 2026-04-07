import React from "react";

const PipelineFooter: React.FC = () => (
  <div className="flex items-center justify-center gap-2 py-4">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
    <span className="text-[13px] text-slate-400">
      Last synthesized: Today at 7:42 AM · Next update in 8 min
    </span>
  </div>
);

export default PipelineFooter;
