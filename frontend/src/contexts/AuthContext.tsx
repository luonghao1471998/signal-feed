import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchCurrentUser } from "@/services/authService";

export interface AuthUser {
  id: number;
  plan: "free" | "pro" | "power";
  x_username?: string;
  avatar_url?: string;
  my_categories?: number[];
  /** Chỉ từ GET /api/me khi user là admin (SPEC `users.is_admin`). */
  is_admin?: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  /** Đã gọi xong GET /api/me (session / Bearer). */
  authReady: boolean;
  isAuthenticated: boolean;
  setSession: (user: AuthUser | null, token: string | null) => void;
  /** Tải lại user từ GET /api/me (sau PATCH profile, v.v.). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function clearStoredSession(): void {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user");
}

function isSameUser(a: AuthUser | null, b: AuthUser | null): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.id === b.id &&
    a.plan === b.plan &&
    a.x_username === b.x_username &&
    a.avatar_url === b.avatar_url &&
    a.is_admin === b.is_admin &&
    JSON.stringify(a.my_categories ?? []) === JSON.stringify(b.my_categories ?? [])
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const u = await fetchCurrentUser();
        if (!cancelled) {
          setUser(u);
          if (u) {
            localStorage.setItem("user", JSON.stringify(u));
          } else {
            clearStoredSession();
            setTokenState(null);
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          clearStoredSession();
          setTokenState(null);
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSession = (nextUser: AuthUser | null, nextToken: string | null) => {
    setUser(nextUser);
    setTokenState(nextToken);
    if (nextToken) {
      localStorage.setItem("auth_token", nextToken);
    } else {
      localStorage.removeItem("auth_token");
    }
    if (nextUser) {
      localStorage.setItem("user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("user");
    }
  };

  const refreshUser = useCallback(async () => {
    try {
      const u = await fetchCurrentUser();
      setUser((prev) => (isSameUser(prev, u) ? prev : u));
      if (u) {
        localStorage.setItem("user", JSON.stringify(u));
      } else {
        clearStoredSession();
        setTokenState(null);
      }
    } catch {
      setUser(null);
      clearStoredSession();
      setTokenState(null);
    }
  }, []);

  // Sau thời gian không dùng tab: khi quay lại, kiểm tra session — nếu hết hạn sẽ clear user và OnboardingGate đưa về /login.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshUser();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      token,
      authReady,
      isAuthenticated: Boolean(user),
      setSession,
      refreshUser,
    }),
    [user, token, authReady, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
