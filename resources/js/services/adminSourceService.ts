import { authFetchHeaders, ensureSanctumCsrf } from "@/services/authService";
import type { Category } from "@/services/categoryService";

export type AdminSourceStatus = "pending_review" | "active" | "spam" | "deleted";
export type AdminSourceType = "user" | "default";
export type ModerateAction = "approve" | "flag_spam" | "soft_delete" | "restore" | "adjust_categories";

export interface AdminSource {
  id: number;
  x_handle: string;
  display_name: string | null;
  account_url: string | null;
  categories: Category[];
  type: AdminSourceType | string;
  status: AdminSourceStatus;
  added_by_user: { id: number; email: string | null } | null;
  signal_count: number;
  noise_ratio: number | null;
  created_at: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links?: {
    first?: string | null;
    last?: string | null;
    prev?: string | null;
    next?: string | null;
  };
}

export interface FetchAdminSourcesParams {
  type?: AdminSourceType;
  status?: AdminSourceStatus;
  page?: number;
}

export interface ModeratePayload {
  action: ModerateAction;
  category_ids?: number[];
}

interface ModerateResponse {
  data: {
    id: number;
    x_handle: string;
    status: AdminSourceStatus;
    category_ids: number[];
    updated_at: string | null;
  };
}

function withErrorMessage(status: number, fallback: string): string {
  return `${fallback} (${status})`;
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as {
      message?: string;
      error?: { message?: string };
    };
    if (typeof data.message === "string" && data.message.trim() !== "") {
      return data.message;
    }
    if (typeof data.error?.message === "string" && data.error.message.trim() !== "") {
      return data.error.message;
    }
  } catch {
    // noop
  }

  return withErrorMessage(response.status, fallback);
}

export async function fetchAdminSources(params: FetchAdminSourcesParams): Promise<PaginatedResponse<AdminSource>> {
  const search = new URLSearchParams();
  search.set("type", params.type ?? "user");
  search.set("status", params.status ?? "pending_review");
  search.set("page", String(params.page ?? 1));

  const response = await fetch(`/api/admin/sources?${search.toString()}`, {
    method: "GET",
    credentials: "same-origin",
    headers: authFetchHeaders(),
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Failed to fetch admin sources");
    throw new Error(message);
  }

  return (await response.json()) as PaginatedResponse<AdminSource>;
}

export async function moderateSource(sourceId: number, payload: ModeratePayload): Promise<ModerateResponse["data"]> {
  await ensureSanctumCsrf();
  const response = await fetch(`/api/admin/sources/${sourceId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: authFetchHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Failed to moderate source");
    throw new Error(message);
  }

  const json = (await response.json()) as ModerateResponse;
  return json.data;
}
