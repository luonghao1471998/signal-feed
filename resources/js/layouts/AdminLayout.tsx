import React from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const AdminLayout: React.FC = () => {
  const { user, authReady } = useAuth();
  const { pathname } = useLocation();

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9f9] text-[#536471]">
        Đang tải…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.is_admin) {
    return <Navigate to="/digest" replace />;
  }

  const nav = [
    { to: "/admin/sources", label: "Nguồn (moderation)" },
    { to: "/admin/pipeline", label: "Pipeline" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f9f9]">
      <header className="border-b border-[#eff3f4] bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-[18px] font-bold text-[#0f1419]">Admin</span>
            <nav className="flex gap-1">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-full px-4 py-2 text-[15px] transition-colors",
                    pathname === item.to || pathname.startsWith(`${item.to}/`)
                      ? "bg-[#eff3f4] font-bold text-[#0f1419]"
                      : "text-[#536471] hover:bg-[#f7f9f9]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <Link to="/digest" className="text-[15px] font-medium text-[#1d9bf0] hover:underline">
            ← Về Digest
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;