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

export interface SubscribeResponse {
  message: string;
  current_count: number;
  limit: number;
  upgrade_required?: boolean;
}

export interface BulkSubscribeResponse {
  message: string;
  subscribed_count: number;
  total_count: number;
  limit: number;
  hit_limit: boolean;
  upgrade_required: boolean;
}

export interface SourceStats {
  signal_count: number;
  last_active_date: string | null;
}

export interface MySource extends Source {
  subscribed_at: string;
  stats: SourceStats;
}

export interface MySourcesResponse {
  data: MySource[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export interface MySourcesTopActiveSource {
  source_id: number;
  handle: string;
  display_name: string | null;
  signal_count: number;
}

export interface MySourcesTrendPoint {
  date: string;
  count: number;
}

export interface MySourcesCategoryBreakdown {
  category_id: number;
  name: string;
  signal_count: number;
}

export interface MySourcesStats {
  total_signals_today: number;
  top_active_sources: MySourcesTopActiveSource[];
  trend_7day: MySourcesTrendPoint[];
  per_category_breakdown: MySourcesCategoryBreakdown[];
}

export interface MySourcesStatsResponse {
  data: MySourcesStats;
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
export async function fetchBrowseSources(params?: {
  limit?: number;
  onboarding?: boolean;
  my_categories_only?: boolean;
  per_page?: number;
}): Promise<BrowseSource[]> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  const token = localStorage.getItem("auth_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const query = new URLSearchParams();
  if (params?.limit && params.limit > 0) {
    query.set("limit", String(params.limit));
  }
  if (params?.onboarding) {
    query.set("onboarding", "1");
  }
  if (params?.my_categories_only) {
    query.set("my_categories_only", "1");
  }
  if (params?.per_page && params.per_page > 0) {
    query.set("per_page", String(params.per_page));
  }

  const response = await fetch(`/api/sources${query.toString() ? `?${query.toString()}` : ""}`, {
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
 * GET /api/sources onboarding mode — sources filtered by user categories.
 */
export async function getOnboardingKOLs(): Promise<BrowseSource[]> {
  return fetchBrowseSources({
    onboarding: true,
    my_categories_only: true,
    per_page: 10,
  });
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
export async function subscribeToSource(sourceId: number): Promise<SubscribeResponse> {
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

  const json = (await response.json()) as {
    message?: string;
    current_count?: number;
    limit?: number;
    upgrade_required?: boolean;
  };

  return {
    message: json.message ?? "Subscribed successfully",
    current_count: json.current_count ?? 0,
    limit: json.limit ?? 0,
    upgrade_required: json.upgrade_required ?? false,
  };
}

/**
 * POST /api/sources/bulk-subscribe — follow multiple KOLs at once.
 */
export async function bulkSubscribeSources(sourceIds: number[]): Promise<BulkSubscribeResponse> {
  await ensureSanctumCsrf();

  const response = await fetch("/api/sources/bulk-subscribe", {
    method: "POST",
    headers: authFetchHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ source_ids: sourceIds }),
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new SourceSubscriptionError(message, response.status);
  }

  const json = (await response.json()) as {
    message?: string;
    subscribed_count?: number;
    total_count?: number;
    limit?: number;
    hit_limit?: boolean;
    upgrade_required?: boolean;
  };

  return {
    message: json.message ?? "Subscribed successfully",
    subscribed_count: json.subscribed_count ?? 0,
    total_count: json.total_count ?? 0,
    limit: json.limit ?? 0,
    hit_limit: json.hit_limit ?? false,
    upgrade_required: json.upgrade_required ?? false,
  };
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

/**
 * GET /api/my-sources — subscribed sources list.
 */
export async function getMySourcesAPI(page = 1): Promise<MySourcesResponse> {
  const response = await fetch(`/api/my-sources?page=${page}`, {
    method: "GET",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch my sources");
  }

  const json = (await response.json()) as {
    data?: MySource[];
    meta?: {
      current_page?: number;
      last_page?: number;
      total?: number;
      per_page?: number;
    };
  };

  return {
    data: json.data ?? [],
    current_page: json.meta?.current_page ?? 1,
    last_page: json.meta?.last_page ?? 1,
    total: json.meta?.total ?? 0,
    per_page: json.meta?.per_page ?? 20,
  };
}

/**
 * GET /api/my-sources — current subscriptions total count.
 */
export async function getCurrentSubscriptionCount(): Promise<number> {
  const response = await getMySourcesAPI(1);
  return response.total ?? 0;
}

/**
 * GET /api/my-sources/stats — aggregate stats for subscribed sources.
 */
export async function getMySourcesStatsAPI(): Promise<MySourcesStatsResponse> {
  const response = await fetch("/api/my-sources/stats", {
    method: "GET",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch My KOLs stats");
  }

  const json = (await response.json()) as MySourcesStatsResponse;
  return {
    data: {
      total_signals_today: json.data?.total_signals_today ?? 0,
      top_active_sources: json.data?.top_active_sources ?? [],
      trend_7day: json.data?.trend_7day ?? [],
      per_category_breakdown: json.data?.per_category_breakdown ?? [],
    },
  };
}

export const sourceService = {
  bulkSubscribeSources,
  createSource,
  getCurrentSubscriptionCount,
  getOnboardingKOLs,
  getMySourcesAPI,
  getMySourcesStatsAPI,
  subscribeToSource,
  unsubscribeFromSource,
};
