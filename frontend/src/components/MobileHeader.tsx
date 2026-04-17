import React from "react";
import { Zap, Filter } from "lucide-react";

interface MobileHeaderProps {
  title: string;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ title }) => {
  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-100 px-4 h-12 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-blue-500" />
        <span className="text-base font-bold text-slate-900">{title}</span>
      </div>
      <button
        type="button"
        className="p-2 rounded-full hover:bg-slate-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <Filter className="w-4 h-4 text-slate-500" />
      </button>
    </header>
  );
};

export default MobileHeader;
