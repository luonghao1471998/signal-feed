import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Archive, Newspaper, Settings, Users, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import OnboardingGate from "@/components/OnboardingGate";

const tabs = [
  { to: "/digest", label: "Digest", icon: Newspaper },
  { to: "/my-kols", label: "My KOLs", icon: Users },
  { to: "/archive", label: "Archive", icon: Archive },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function tabIsActive(pathname: string, to: string): boolean {
  if (to === "/digest") return pathname === "/digest" || pathname.startsWith("/digest/");
  return pathname === to || pathname.startsWith(`${to}/`);
}

const PWALayout: React.FC = () => {
  const location = useLocation();
  const { shouldShow, install, dismiss } = useInstallPrompt();

  return (
    <div className="min-h-screen bg-white flex flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex-1 min-h-0">
        <OnboardingGate>
          <Outlet />
        </OnboardingGate>
      </div>

      {shouldShow && (
        <div
          className="fixed left-0 right-0 z-50 px-4 flex justify-center pointer-events-none"
          style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div
            className="pointer-events-auto w-full max-w-lg bg-slate-900 text-white px-4 py-3 flex items-center gap-3 rounded-t-xl shadow-lg sf-install-banner-enter"
            role="dialog"
            aria-label="Install app"
          >
            <Zap className="w-5 h-5 text-amber-300 shrink-0" aria-hidden />
            <p className="text-sm font-medium flex-1 min-w-0">Add SignalFeed to Home Screen</p>
            <button
              type="button"
              onClick={() => void install()}
              className="bg-white text-slate-900 rounded-full px-3 py-1 text-xs font-bold shrink-0"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="p-1 rounded-full hover:bg-white/10 shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 h-14 bg-white border-t border-[#eff3f4] flex items-stretch pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Main"
      >
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = tabIsActive(location.pathname, to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to !== "/digest"}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 min-w-0",
                active ? "text-[#1d9bf0]" : "text-[#536471]",
              )}
            >
              <Icon className="w-[22px] h-[22px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-[#1d9bf0] mt-0.5" aria-hidden />}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default PWALayout;
