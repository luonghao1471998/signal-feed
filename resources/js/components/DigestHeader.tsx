import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DigestHeader: React.FC = () => {
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 py-3 mb-0 bg-white/85 backdrop-blur-md border-b border-slate-100">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Digest</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-slate-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
          >
            Tue, Mar 31, 2026
            <ChevronRight className="w-3 h-3 text-slate-500 rotate-90" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-slate-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            Today
          </button>
        </div>
      </div>
    </div>
  );
};

export default DigestHeader;
