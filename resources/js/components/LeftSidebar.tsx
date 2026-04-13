import React from "react";
import { NavLink } from "react-router-dom";
import { Zap, Users, Bookmark, Settings, MoreHorizontal, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/digest", label: "Digest", icon: Zap },
  { to: "/my-kols", label: "My KOLs", icon: Users },
  { to: "/archive", label: "Archive", icon: Bookmark },
  { to: "/settings", label: "Settings", icon: Settings },
];

const LogoBolt = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="#1d9bf0" aria-hidden className="shrink-0">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const LeftSidebar: React.FC = () => {
  const { user } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-[240px] h-screen border-r border-[#eff3f4] bg-white fixed left-0 top-0 z-30">
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-6">
        <LogoBolt />
        <span className="text-[20px] font-extrabold text-[#0f1419] tracking-tight">SignalFeed</span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to !== "/digest"}
            className={({ isActive }) =>
              cn(
                "flex w-full cursor-pointer items-center gap-4 rounded-full border-none bg-transparent text-left text-[19px] text-[#0f1419] transition-colors",
                "px-4 py-3",
                isActive ? "font-[700]" : "font-[400] hover:bg-[#eff3f4]",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className="h-6 w-6 shrink-0 text-[#0f1419]"
                  strokeWidth={isActive ? 2.5 : 1.8}
                  fill="none"
                  aria-hidden
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
        {user?.is_admin && (
          <NavLink
            to="/admin/sources"
            className={({ isActive }) =>
              cn(
                "flex w-full cursor-pointer items-center gap-4 rounded-full border-none bg-transparent text-left text-[19px] text-[#0f1419] transition-colors",
                "px-4 py-3",
                isActive ? "font-[700]" : "font-[400] hover:bg-[#eff3f4]",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Shield
                  className="h-6 w-6 shrink-0 text-[#0f1419]"
                  strokeWidth={isActive ? 2.5 : 1.8}
                  aria-hidden
                />
                Admin
              </>
            )}
          </NavLink>
        )}
      </nav>

      <div className="p-3">
        <div className="flex w-full cursor-pointer items-center gap-3 rounded-full p-2 transition-colors hover:bg-[#eff3f4]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-[15px] font-bold text-white">
            U
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[#0f1419]">User</p>
            <p className="text-[13px] text-[#536471]">Pro plan</p>
          </div>
          <button
            type="button"
            className="ml-auto shrink-0 rounded-full p-1 text-[#536471] hover:bg-[#eff3f4]"
            aria-label="More"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default LeftSidebar;
