import React from "react";
import { Search } from "lucide-react";

const topCategories = [
  { name: "AI & ML", count: 18 },
  { name: "Dev Tools", count: 12 },
  { name: "Marketing", count: 8 },
  { name: "Startup/VC", count: 5 },
  { name: "Crypto", count: 4 },
];

const maxSaved = Math.max(...topCategories.map((c) => c.count), 1);

interface ArchiveRightPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

const ArchiveRightPanel: React.FC<ArchiveRightPanelProps> = ({ searchQuery, onSearchChange }) => {
  return (
    <aside className="hidden lg:flex flex-col w-[280px] h-screen border-l border-slate-100 bg-[#F7F9F9] fixed right-0 top-0 z-30 p-4 gap-4 overflow-y-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search signals..."
          className="w-full pl-10 pr-4 py-2 text-sm bg-[#EFF3F4] border-none rounded-full placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border focus:border-blue-400 focus:ring-0 transition-colors"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Your Archive</h3>
        <div className="space-y-2 text-sm text-slate-900 font-medium">
          <p>47 saved</p>
          <p>30 days window</p>
          <p>12 this week</p>
          <p>5 categories</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Most Saved</h3>
        <ul className="space-y-3">
          {topCategories.map((row) => (
            <li key={row.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-900 font-medium">{row.name}</span>
                <span className="text-slate-400 tabular-nums">{row.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all"
                  style={{ width: `${(row.count / maxSaved) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default ArchiveRightPanel;
