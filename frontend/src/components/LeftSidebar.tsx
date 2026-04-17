import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Zap, Users, Bookmark, Settings, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { authFetchHeaders, ensureSanctumCsrf } from "@/services/authService";
import { useLocale } from "@/i18n";

const LogoBolt = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="#1d9bf0" aria-hidden className="shrink-0">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const LeftSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { user, setSession } = useAuth();
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = [
    { to: "/digest", label: t("nav.digest"), icon: Zap },
    { to: "/my-kols", label: t("nav.myKols"), icon: Users },
    { to: "/archive", label: t("nav.archive"), icon: Bookmark },
    { to: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const username = user?.x_username ?? "User";
  const displayName = username.startsWith("@") ? username : `@${username}`;
  const avatarInitial = (user?.x_username?.[0] ?? "U").toUpperCase();
  const showAvatarImage = Boolean(user?.avatar_url) && !avatarBroken;
  const planLabel =
    user?.plan === "power"
      ? t("sidebar.powerPlan")
      : user?.plan === "pro"
        ? t("sidebar.proPlan")
        : t("sidebar.freePlan");

  useEffect(() => {
    setAvatarBroken(false);
  }, [user?.avatar_url]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      await ensureSanctumCsrf();
      await fetch("/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: authFetchHeaders(),
      });
    } catch {
      // ignore network/session errors on logout path
    } finally {
      setSession(null, null);
      setMenuOpen(false);
      setLoggingOut(false);
      navigate("/login", { replace: true });
    }
  };

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
      </nav>

      <div className="p-3" ref={menuRef}>
        <div className="relative flex w-full items-center gap-3 rounded-full p-2 transition-colors hover:bg-[#eff3f4]">
          {showAvatarImage ? (
            <img
              src={user.avatar_url}
              alt={displayName}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-[15px] font-bold text-white">
              {avatarInitial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[#0f1419]">{displayName}</p>
            <p className="text-[13px] text-[#536471]">{planLabel}</p>
          </div>
          <button
            type="button"
            className="ml-auto shrink-0 rounded-full p-1 text-[#536471] hover:bg-[#eff3f4]"
            aria-label={t("sidebar.more")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {menuOpen && (
            <div className="absolute bottom-12 right-0 z-50 min-w-[160px] rounded-xl border border-[#eff3f4] bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-[#0f1419] hover:bg-[#f7f9f9] disabled:opacity-60"
              >
                {loggingOut ? t("sidebar.loggingOut") : t("sidebar.logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default LeftSidebar;