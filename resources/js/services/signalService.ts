import type { SignalsResponse } from "@/types/signal";

export interface FetchSignalsParams {
  date?: string;
  categoryIds?: number[];
  mySourcesOnly?: boolean;
  topicTag?: string;
  page?: number;
  perPage?: number;
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

  return response.json() as Promise<SignalsResponse>;
}

export interface ApiCategory {
  id: number;
  name: string;
  slug: string;
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  const response = await fetch("/api/categories", {
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("Failed to load categories");
  }
  const json = (await response.json()) as { data?: ApiCategory[] };
  return json.data ?? [];
}
