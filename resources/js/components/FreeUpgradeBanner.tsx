import React from "react";
import { Lock } from "lucide-react";

const FreeUpgradeBanner: React.FC = () => {
  return (
    <div className="bg-[#fffbeb] border border-[#fde68a] rounded-xl p-4 my-0">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-[#d97706]" />
        <span className="font-bold text-sm text-slate-900">You&apos;ve seen 3 of today&apos;s signals.</span>
      </div>
      <p className="text-sm text-slate-500 mt-1">
        Upgrade to Pro for full daily digest + draft tweets.
      </p>
      <button
        type="button"
        className="bg-blue-500 text-white rounded-full px-4 py-2 text-sm font-bold mt-3 hover:bg-blue-600 transition-colors"
      >
        Upgrade to Pro →
      </button>
    </div>
  );
};

export default FreeUpgradeBanner;
