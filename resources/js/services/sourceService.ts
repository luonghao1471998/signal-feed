import { authFetchHeaders, ensureSanctumCsrf } from "@/services/authService";

export interface BrowseSourceCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
}

export interface BrowseSource {
  id: number;
  x_handle: string;
  display_name: string | null;
  account_url: string;
  type: string;
  status: string;
  categories: BrowseSourceCategory[];
  is_subscribed: boolean;
}

export interface CreateSourceRequest {
  handle: string;
  display_name?: string;
  category_ids: number[];
}

export type SourceStatus = "pending_review" | "active" | "spam" | "deleted";

export interface Source {
  id: number;
  handle: string;
  display_name: string | null;
  account_url: string;
  type: "default" | "user";
  status: SourceStatus;
  follower_count: number | null;
  categories: Array<{ id: number; name: string; slug?: string }>;
  is_subscribed: boolean;
}

/** Response payload from POST /api/sources (subset of fields returned). */
export interface CreatedSourcePayload {
  id: number;
  handle: string;
  display_name: string | null;
  account_url: string;
  type: string;
  status: SourceStatus;
  categories: { id: number; name: string }[];
  is_subscribed: boolean;
}

export class CreateSourceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "CreateSourceError";
  }
}

export class SourceSubscriptionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SourceSubscriptionError";
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string };
    if (data?.message && typeof data.message === "string") {
      return data.message;
    }
  } catch {
    /* ignore */
  }
  return `Request failed (${response.status})`;
}

/**
 * GET /api/sources — public browse pool (active sources).
 */
export async function fetchBrowseSources(): Promise<BrowseSource[]> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  const token = localStorage.getItem("auth_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch("/api/sources", {
    headers,
    credentials: "same-origin",
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  const json = (await response.json()) as { data?: BrowseSource[] };
  return json.data ?? [];
}

/**
 * POST /api/sources — Pro/Power; Sanctum CSRF + Bearer.
 */
export async function createSource(payload: CreateSourceRequest): Promise<CreatedSourcePayload> {
  await ensureSanctumCsrf();

  const body: Record<string, unknown> = {
    handle: payload.handle,
    category_ids: payload.category_ids,
  };
  if (payload.display_name !== undefined && payload.display_name.trim() !== "") {
    body.display_name = payload.display_name.trim();
  }

  const response = await fetch("/api/sources", {
    method: "POST",
    headers: authFetchHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    throw new CreateSourceError("Authentication required. Please sign in.", 401);
  }

  if (response.status === 403) {
    const message = await parseErrorMessage(response);
    throw new CreateSourceError(message, 403);
  }

  if (response.status === 422) {
    let fieldErrors: Record<string, string[]> | undefined;
    let message = "Validation failed";
    try {
      const data = (await response.json()) as {
        message?: string;
        errors?: Record<string, string[]>;
      };
      if (typeof data.message === "string") {
        message = data.message;
      }
      if (data.errors && typeof data.errors === "object") {
        fieldErrors = data.errors;
      }
    } catch {
      /* ignore */
    }
    throw new CreateSourceError(message, 422, fieldErrors);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new CreateSourceError(message, response.status);
  }

  const json = (await response.json()) as { data?: CreatedSourcePayload };
  const data = json.data;
  if (!data || typeof data.id !== "number") {
    throw new CreateSourceError("Invalid response from server", 500);
  }

  return data;
}

/**
 * POST /api/sources/{id}/subscribe — follow KOL.
 */
export async function subscribeToSource(sourceId: number): Promise<void> {
  await ensureSanctumCsrf();

  const response = await fetch(`/api/sources/${sourceId}/subscribe`, {
    method: "POST",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new SourceSubscriptionError(message, response.status);
  }
}

/**
 * DELETE /api/sources/{id}/subscribe — unfollow KOL.
 */
export async function unsubscribeFromSource(sourceId: number): Promise<void> {
  await ensureSanctumCsrf();

  const response = await fetch(`/api/sources/${sourceId}/subscribe`, {
    method: "DELETE",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new SourceSubscriptionError(message, response.status);
  }
}

export const sourceService = {
  createSource,
  subscribeToSource,
  unsubscribeFromSource,
};
