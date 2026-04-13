import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchCurrentUser } from "@/services/authService";

export interface AuthUser {
  id: number;
  plan: "free" | "pro" | "power";
  x_username?: string;
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
            localStorage.removeItem("user");
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
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

  const refreshUser = async () => {
    try {
      const u = await fetchCurrentUser();
      setUser(u);
      if (u) {
        localStorage.setItem("user", JSON.stringify(u));
      } else {
        localStorage.removeItem("user");
      }
    } catch {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      token,
      authReady,
      isAuthenticated: Boolean(user),
      setSession,
      refreshUser,
    }),
    [user, token, authReady],
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
