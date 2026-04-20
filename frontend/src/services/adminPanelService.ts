import { ensureSanctumCsrf } from "@/services/authService";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function headers(withJson = false): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (withJson) {
    h["Content-Type"] = "application/json";
  }
  const token = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1];
  if (token) {
    try {
      h["X-XSRF-TOKEN"] = decodeURIComponent(token);
    } catch {
      h["X-XSRF-TOKEN"] = token;
    }
  }
  return h;
}

async function request<T>(url: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
  if (method !== "GET") {
    await ensureSanctumCsrf();
  }

  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: headers(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `${method} ${url} failed (${response.status})`;
    try {
      const json = (await response.json()) as {
        message?: string;
        error?: string;
        errors?: Record<string, string[]>;
      };
      let extracted: string | undefined;
      if (json.errors && typeof json.errors === "object") {
        for (const arr of Object.values(json.errors)) {
          if (Array.isArray(arr) && arr[0]) {
            extracted = arr[0];
            break;
          }
        }
      }
      if (extracted) {
        message = extracted;
      } else if (typeof json.message === "string" && json.message.length > 0) {
        message = json.message;
      } else if (typeof json.error === "string" && json.error.length > 0) {
        message = json.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export function listDigests(params: URLSearchParams) {
  return request<{ data: unknown[]; meta: unknown }>(`/admin/api/digests?${params.toString()}`);
}
export function createDigest(payload: unknown) {
  return request("/admin/api/digests", "POST", payload);
}
export function updateDigest(id: number, payload: unknown) {
  return request(`/admin/api/digests/${id}`, "PATCH", payload);
}
export function deleteDigest(id: number) {
  return request(`/admin/api/digests/${id}`, "DELETE");
}

export function listSignals(params: URLSearchParams) {
  return request<{ data: unknown[]; meta: unknown; filters?: unknown }>(`/admin/api/signals?${params.toString()}`);
}
export function getSignal(id: number) {
  return request<{ data: unknown }>(`/admin/api/signals/${id}`);
}
export function createSignal(payload: unknown) {
  return request("/admin/api/signals", "POST", payload);
}
export function updateSignal(id: number, payload: unknown) {
  return request(`/admin/api/signals/${id}`, "PATCH", payload);
}
export function deleteSignal(id: number) {
  return request(`/admin/api/signals/${id}`, "DELETE");
}

export function listTweets(params: URLSearchParams) {
  return request<{ data: unknown[]; meta: unknown; filters?: unknown }>(`/admin/api/tweets?${params.toString()}`);
}
export function getTweet(id: number) {
  return request<{ data: unknown }>(`/admin/api/tweets/${id}`);
}
export function createTweet(payload: unknown) {
  return request("/admin/api/tweets", "POST", payload);
}
export function updateTweet(id: number, payload: unknown) {
  return request(`/admin/api/tweets/${id}`, "PATCH", payload);
}
export function deleteTweet(id: number) {
  return request(`/admin/api/tweets/${id}`, "DELETE");
}

export function listSources(params: URLSearchParams) {
  return request<{ data: unknown[]; meta: unknown; filters?: unknown }>(`/admin/api/sources?${params.toString()}`);
}
export function getSource(id: number) {
  return request<{ data: unknown }>(`/admin/api/sources/${id}`);
}
export function createSource(payload: unknown) {
  return request("/admin/api/sources", "POST", payload);
}
export function updateSource(id: number, payload: unknown) {
  return request(`/admin/api/sources/${id}`, "PATCH", payload);
}
export function deleteSource(id: number) {
  return request(`/admin/api/sources/${id}`, "DELETE");
}

export function listCategories(params: URLSearchParams) {
  return request<{ data: unknown[]; meta: unknown }>(`/admin/api/categories?${params.toString()}`);
}
export function getCategory(id: number) {
  return request<{ data: unknown }>(`/admin/api/categories/${id}`);
}
export function createCategory(payload: unknown) {
  return request("/admin/api/categories", "POST", payload);
}
export function updateCategory(id: number, payload: unknown) {
  return request(`/admin/api/categories/${id}`, "PATCH", payload);
}
export function deleteCategory(id: number) {
  return request(`/admin/api/categories/${id}`, "DELETE");
}

export function listUsers(params: URLSearchParams) {
  return request<{ data: unknown[]; meta: unknown; filters?: unknown }>(`/admin/api/users?${params.toString()}`);
}
export function updateUser(id: number, payload: unknown) {
  return request(`/admin/api/users/${id}`, "PATCH", payload);
}
export function getUser(id: number) {
  return request<{ data: unknown }>(`/admin/api/users/${id}`);
}

export function listAdmins(params: URLSearchParams) {
  return request<{ data: unknown[]; meta: unknown }>(`/admin/api/admins?${params.toString()}`);
}
export function createAdmin(payload: unknown) {
  return request("/admin/api/admins", "POST", payload);
}
export function updateAdmin(id: number, payload: unknown) {
  return request(`/admin/api/admins/${id}`, "PATCH", payload);
}
export function getAdmin(id: number) {
  return request<{ data: unknown }>(`/admin/api/admins/${id}`);
}
export function deleteAdmin(id: number) {
  return request(`/admin/api/admins/${id}`, "DELETE");
}
