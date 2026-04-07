import React from "react";
import { NavLink } from "react-router-dom";
import { Newspaper, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/digest", label: "Digest", icon: Newspaper },
  { to: "/my-kols", label: "My KOLs", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

const MobileNav: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 border-t border-[#eff3f4] bg-white/95 backdrop-blur-md flex items-center justify-around px-2">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to !== "/digest"}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] rounded-lg transition-colors",
              isActive ? "text-[#1d9bf0]" : "text-[#536471]",
            )
          }
        >
          {({ isActive }) => (
            <>
              <tab.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.75} />
              <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

export default MobileNav;
