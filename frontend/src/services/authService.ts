import type { AuthUser } from "@/contexts/AuthContext";

function normalizeUser(data: Record<string, unknown>): AuthUser | null {
  const id = data.id;
  const plan = data.plan;
  if (typeof id !== "number" || typeof plan !== "string") {
    return null;
  }
  const p = plan === "pro" || plan === "power" || plan === "free" ? plan : "free";
  const x_username = typeof data.x_username === "string" ? data.x_username : undefined;
  const avatar_url = typeof data.avatar_url === "string" ? data.avatar_url : undefined;
  const my_categories = Array.isArray(data.my_categories)
    ? data.my_categories
        .map((x) => {
          if (typeof x === "number" && Number.isFinite(x)) {
            return x;
          }
          if (typeof x === "string" && x.trim() !== "") {
            const parsed = Number(x);
            return Number.isFinite(parsed) ? parsed : null;
          }
          return null;
        })
        .filter((x): x is number => typeof x === "number" && x > 0)
    : [];
  const is_admin = data.is_admin === true;
  return { id, plan: p, x_username, avatar_url, my_categories, is_admin };
}

/** Session Sanctum hoặc Bearer — cookie gửi kèm same-origin. */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  const t = localStorage.getItem("auth_token");
  if (t) {
    headers.Authorization = `Bearer ${t}`;
  }

  const res = await fetch("/api/me", {
    credentials: "same-origin",
    headers,
  });

  if (res.status === 401) {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  try {
    const data = (await res.json()) as Record<string, unknown>;
    return normalizeUser(data);
  } catch {
    return null;
  }
}

/** Gọi trước POST/PATCH/DELETE tới API stateful để refresh cookie CSRF. */
export async function ensureSanctumCsrf(): Promise<void> {
  await fetch("/sanctum/csrf-cookie", {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
}

function xsrfTokenFromCookie(): string | null {
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  if (!m?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/** Header cho fetch JSON tới `/api/*` khi dùng Sanctum stateful (cookie + Bearer). */
export function authFetchHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  const xsrf = xsrfTokenFromCookie();
  if (xsrf) {
    headers["X-XSRF-TOKEN"] = xsrf;
  }
  const t = localStorage.getItem("auth_token");
  if (t) {
    headers.Authorization = `Bearer ${t}`;
  }
  return headers;
}

/** PATCH my_categories (1–3 category IDs). Session Sanctum + CSRF hoặc Bearer. */
export async function updateCurrentUserMyCategories(myCategories: number[]): Promise<AuthUser | null> {
  await ensureSanctumCsrf();
  const res = await fetch("/api/me", {
    method: "PATCH",
    credentials: "same-origin",
    headers: authFetchHeaders(),
    body: JSON.stringify({ my_categories: myCategories }),
  });

  if (res.status === 401) {
    return null;
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as {
        message?: string;
        errors?: Record<string, string[]>;
      };
      if (data.message) {
        msg = data.message;
      } else if (data.errors) {
        const first = Object.values(data.errors).flat()[0];
        if (typeof first === "string") {
          msg = first;
        }
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  try {
    const data = (await res.json()) as Record<string, unknown>;
    return normalizeUser(data);
  } catch {
    return null;
  }
}