import React from "react";
import { Link } from "react-router-dom";
import { Av, avatarUrlForHandle } from "@/components/Avatar";
import { cn } from "@/lib/utils";

const kolRows = [
  { handle: "@sama", name: "Sam Altman", signals: 3 },
  { handle: "@karpathy", name: "Andrej Karpathy", signals: 2 },
  { handle: "@rauchg", name: "Guillermo Rauch", signals: 2 },
  { handle: "@levelsio", name: "Pieter Levels", signals: 1 },
];

const RightPanel: React.FC = () => {
  return (
    <aside
      className="sticky top-0 z-20 hidden h-screen max-w-[350px] min-w-[280px] w-[28%] flex-col overflow-y-auto bg-white px-7 py-4 lg:flex"
      aria-label="Digest sidebar"
    >
      <div className="mt-2 rounded-2xl bg-[#f7f9f9] p-4">
        <h2 className="mb-3 text-[19px] font-extrabold text-[#0f1419]">Today</h2>
        <div className="flex gap-6">
          <div>
            <p className="text-[28px] font-extrabold leading-none text-[#0f1419]">14</p>
            <p className="mt-1 text-[13px] text-[#536471]">signals</p>
          </div>
          <div>
            <p className="text-[28px] font-extrabold leading-none text-[#0f1419]">47</p>
            <p className="mt-1 text-[13px] text-[#536471]">KOLs active</p>
          </div>
        </div>
      </div>

      <div className="mb-4 mt-4 max-h-none overflow-visible rounded-2xl bg-[#f7f9f9] p-4">
        <h2 className="mb-3.5 text-[19px] font-extrabold text-[#0f1419]">Your KOLs today</h2>
        <div className="max-h-none space-y-0 overflow-visible">
          {kolRows.map((row, i) => (
            <Link
              key={row.handle}
              to="/my-kols"
              className={cn(
                "flex items-center gap-2.5 no-underline transition-colors hover:bg-[#e8e8e8]",
                i > 0 && "border-t border-[#eff3f4]",
              )}
              style={{ padding: "10px 4px" }}
            >
              <Av src={avatarUrlForHandle(row.handle)} name={row.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold leading-tight text-[#0f1419]">{row.name}</p>
                <p className="text-[13px] leading-tight text-[#536471]">{row.handle}</p>
              </div>
              <span
                className="shrink-0 rounded-full text-[13px] text-[#1d9bf0]"
                style={{ background: "#e8f5fd", padding: "2px 10px" }}
              >
                {row.signals} signals
              </span>
            </Link>
          ))}
        </div>
        <Link
          to="/my-kols"
          className="mt-2 block py-1 text-[#1d9bf0] no-underline hover:underline"
          style={{ fontSize: 15 }}
        >
          Show more
        </Link>
      </div>

      <footer className="mt-auto px-1 py-1 text-[13px] leading-[1.8] text-[#536471]">
        <p>Terms · Privacy · About</p>
        <p>© 2026 SignalFeed</p>
      </footer>
    </aside>
  );
};

export default RightPanel;
