import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureSanctumCsrf } from "@/services/authService";
import "@/styles/admin-shell.css";

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
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
      const res = await fetch("/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        let msg = "Đăng nhập thất bại";
        try {
          const data = (await res.json()) as { message?: string; errors?: { email?: string[] } };
          if (data.errors?.email?.[0]) {
            msg = data.errors.email[0];
          } else if (data.message) {
            msg = data.message;
          }
        } catch {
          // ignore
        }
        setError(msg);
        return;
      }
      navigate("/admin/dashboard", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-shell admin-shell__login-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-slate-500/20 blur-3xl" />
        <div className="absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-slate-400/15 blur-3xl" />
      </div>
      <div className="relative w-full max-w-[420px] rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl shadow-slate-950/25 ring-1 ring-slate-400/20 backdrop-blur-md">
        <div className="mx-auto h-1 w-12 rounded-full bg-slate-400" />
        <p className="mt-5 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">SignalFeed</p>
        <h1 className="mt-2 text-center text-xl font-semibold tracking-tight text-slate-900">Admin sign in</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Use your admin account credentials.</p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="admin-email" className="text-slate-700">
              Email
            </Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-slate-200 bg-white focus-visible:ring-slate-400/40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password" className="text-slate-700">
              Password
            </Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-slate-200 bg-white focus-visible:ring-slate-400/40"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            className="w-full bg-slate-900 text-white shadow-md shadow-slate-900/25 transition hover:bg-slate-800"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Login"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
