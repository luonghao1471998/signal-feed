import React, { useState } from "react";
import {
  LayoutDashboard,
  Newspaper,
  SignalHigh,
  MessageSquareText,
  Database,
  ShieldCheck,
  Tags,
  Activity,
  Users,
  UserCog,
  Menu,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ensureSanctumCsrf } from "@/services/authService";
import { Button } from "@/components/ui/button";
import "@/styles/admin-shell.css";

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/digests", label: "Digest", icon: Newspaper },
    { to: "/admin/signals", label: "Signals", icon: SignalHigh },
    { to: "/admin/tweets", label: "Tweets", icon: MessageSquareText },
    { to: "/admin/sources", label: "Sources", icon: Database },
    { to: "/admin/source-moderation", label: "Source Moderation Queue", icon: ShieldCheck },
    { to: "/admin/categories", label: "Categories", icon: Tags },
    { to: "/admin/pipeline", label: "Pipeline", icon: Activity },
    { to: "/admin/users", label: "User", icon: Users },
    { to: "/admin/admins", label: "Admin", icon: UserCog },
  ];

  React.useEffect(() => {
    const match = nav.find((item) => location.pathname.startsWith(item.to));
    document.title = `${match?.label ?? "Admin"} | SignalFeed Admin`;
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await ensureSanctumCsrf();
      const xsrf = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1];
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      };
      if (xsrf) {
        try {
          headers["X-XSRF-TOKEN"] = decodeURIComponent(xsrf);
        } catch {
          headers["X-XSRF-TOKEN"] = xsrf;
        }
      }
      await fetch("/admin/logout", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: "{}",
      });
    } catch {
      // ignore
    } finally {
      setLoggingOut(false);
      navigate("/admin/login", { replace: true });
    }
  };

  return (
    <div className="admin-shell flex min-h-screen text-slate-900">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-[272px] flex-col bg-slate-900 text-slate-200 shadow-xl shadow-slate-950/40 transition-transform duration-300 ease-in-out",
          "lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 pb-5 pt-6">
          <p className="mt-2 text-2xl font-bold uppercase tracking-[0.18em] text-white">SIGNALFEED</p>
          <button
            type="button"
            className="mt-2 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  isActive
                    ? "bg-white/10 font-medium text-white shadow-inner ring-1 ring-white/10"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300",
                    )}
                    strokeWidth={1.75}
                  />
                  <span className="leading-snug">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <Button
            type="button"
            variant="outline"
            className="w-full border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
            disabled={loggingOut}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-slate-200/60 bg-white/90 px-4 backdrop-blur-md lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 text-sm font-semibold uppercase tracking-wider text-slate-700">
            SignalFeed Admin
          </span>
        </header>

        {/* Page content */}
        <main className="admin-shell__main-bg min-w-0 flex-1">
          <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
