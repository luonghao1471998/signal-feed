import type { Signal, SignalsResponse } from "@/types/signal";
import { authFetchHeaders, ensureSanctumCsrf } from "@/services/authService";
import { getCategories, type Category } from "@/services/categoryService";

export interface FetchSignalsParams {
  date?: string;
  categoryIds?: number[];
  mySourcesOnly?: boolean;
  topicTag?: string;
  page?: number;
  perPage?: number;
}

export interface ArchiveFilters {
  date_range?: "today" | "yesterday" | "last7" | "last30";
  category_id?: number[];
  search?: string;
  page?: number;
  per_page?: number;
}

export interface ArchivedSignalApi {
  id: number;
  title: string;
  summary: string;
  source_count: number;
  // API hiện có thể trả object categories hoặc mảng id từ backend hiện tại
  categories: Array<{ id: number; name: string; slug: string } | number>;
  topic_tags: string[];
  sources?: Array<{
    handle: string;
    display_name: string;
    avatar_url?: string | null;
  }>;
  date: string;
  archived_at: string;
}

export interface ArchiveResponse {
  data: ArchivedSignalApi[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

function getAuthToken(): string | null {
  return localStorage.getItem("auth_token");
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string; error?: { message?: string } };
    if (data?.message && typeof data.message === "string") {
      return data.message;
    }
    if (data?.error?.message && typeof data.error.message === "string") {
      return data.error.message;
    }
  } catch {
    /* ignore */
  }
  return `Request failed (${response.status})`;
}

export async function fetchSignals(params: FetchSignalsParams): Promise<SignalsResponse> {
  const searchParams = new URLSearchParams();

  if (params.date) {
    searchParams.append("date", params.date);
  }

  if (params.categoryIds?.length) {
    params.categoryIds.forEach((id) => {
      searchParams.append("category_id[]", String(id));
    });
  }

  if (params.mySourcesOnly) {
    searchParams.append("my_sources_only", "1");
  }

  if (params.topicTag) {
    searchParams.append("topic_tag", params.topicTag);
  }

  if (params.page && params.page > 1) {
    searchParams.append("page", String(params.page));
  }

  if (params.perPage && params.perPage !== 20) {
    searchParams.append("per_page", String(params.perPage));
  }

  const token = getAuthToken();
  const headers: HeadersInit = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const qs = searchParams.toString();
  const url = qs ? `/api/signals?${qs}` : "/api/signals";

  const response = await fetch(url, {
    headers,
    credentials: "same-origin",
  });

  if (response.status === 401) {
    throw new Error("Authentication required. Please sign in.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  const json = (await response.json()) as SignalsResponse;
  const personalSignalsHeader = response.headers.get("x-personal-signals");

  return {
    ...json,
    meta: {
      ...json.meta,
      isPersonalSignals: personalSignalsHeader === "true",
    },
  };
}

export type ApiCategory = Category;

export async function fetchSignalDetail(id: number): Promise<Signal> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/signals/${id}`, {
    headers,
    credentials: "same-origin",
  });

  if (response.status === 401) {
    throw new Error("Authentication required. Please sign in.");
  }

  if (response.status === 404) {
    throw new Error("Signal not found");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message || "Failed to fetch signal detail");
  }

  const json = (await response.json()) as { data?: Signal };
  if (!json.data) {
    throw new Error("Failed to fetch signal detail");
  }

  return json.data;
}

export interface CopyDraftResult {
  twitter_intent_url: string;
}

/**
 * POST /api/signals/{id}/draft/copy — Twitter Web Intent URL (Pro/Power).
 * Rejects with Error; check `(err as Error & { status?: number }).status` for HTTP code when present.
 */
export async function copyDraft(signalId: number): Promise<CopyDraftResult> {
  await ensureSanctumCsrf();

  const response = await fetch(`/api/signals/${signalId}/draft/copy`, {
    method: "POST",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });

  if (response.status === 401) {
    throw new Error("Authentication required. Please sign in.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    const err = new Error(message) as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  const json = (await response.json()) as { data?: { twitter_intent_url?: string } };
  const url = json.data?.twitter_intent_url;
  if (!url || typeof url !== "string") {
    throw new Error("Invalid response");
  }

  return { twitter_intent_url: url };
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  return getCategories();
}

/** GET /api/archive/signals — archived list with filters + pagination */
export async function fetchArchivedSignals(filters: ArchiveFilters = {}): Promise<ArchiveResponse> {
  await ensureSanctumCsrf();

  const searchParams = new URLSearchParams();
  if (filters.date_range) {
    searchParams.append("date_range", filters.date_range);
  }
  if (filters.category_id?.length) {
    filters.category_id.forEach((id) => searchParams.append("category_id[]", String(id)));
  }
  if (filters.search && filters.search.trim() !== "") {
    searchParams.append("search", filters.search.trim());
  }
  if (filters.page && filters.page > 1) {
    searchParams.append("page", String(filters.page));
  }
  if (filters.per_page && filters.per_page !== 20) {
    searchParams.append("per_page", String(filters.per_page));
  }

  const qs = searchParams.toString();
  const response = await fetch(qs ? `/api/archive/signals?${qs}` : "/api/archive/signals", {
    method: "GET",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });

  if (response.status === 401) {
    throw new Error("Authentication required. Please sign in.");
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as ArchiveResponse;
}

/** POST /api/signals/{id}/archive — idempotent 201/200 */
export async function archiveSignal(signalId: number): Promise<void> {
  await ensureSanctumCsrf();
  const response = await fetch(`/api/signals/${signalId}/archive`, {
    method: "POST",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });
  if (response.status === 401) {
    throw new Error("Authentication required. Please sign in.");
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

/** DELETE /api/signals/{id}/archive — idempotent 204 */
export async function unarchiveSignal(signalId: number): Promise<void> {
  await ensureSanctumCsrf();
  const response = await fetch(`/api/signals/${signalId}/archive`, {
    method: "DELETE",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });
  if (response.status === 401) {
    throw new Error("Authentication required. Please sign in.");
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}