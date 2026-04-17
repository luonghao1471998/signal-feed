import { ensureSanctumCsrf } from "@/services/authService";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  const t = localStorage.getItem("auth_token");
  if (t) {
    headers.Authorization = `Bearer ${t}`;
  }
  return headers;
}

export interface AdminSourceRow {
  id: number;
  handle: string;
  display_name: string | null;
  account_url: string;
  type: string;
  status: string;
  added_by_user: { id: number; email: string | null } | null;
  categories: Array<{ id: number; name: string; slug: string; description: string | null }>;
  created_at: string | null;
  signal_count: number;
  noise_ratio: number | null;
}

export interface AdminSourcesResponse {
  data: AdminSourceRow[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export interface PipelineStatusData {
  last_run_timestamp: string | null;
  tweets_fetched_count: number;
  signals_created_count: number;
  error_rate: number;
  per_category_signal_volume: Array<{
    category_id: number;
    category_name: string;
    signal_count: number;
  }>;
}

export async function fetchAdminSources(params: {
  type?: "user" | "default";
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<AdminSourcesResponse> {
  const search = new URLSearchParams();
  if (params.type) {
    search.set("type", params.type);
  }
  if (params.status) {
    search.set("status", params.status);
  }
  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }
  if (params.perPage) {
    search.set("per_page", String(params.perPage));
  }
  const q = search.toString();
  const res = await fetch(`/admin/api/sources${q ? `?${q}` : ""}`, {
    credentials: "same-origin",
    headers: getAuthHeaders(),
  });
  if (res.status === 403) {
    throw new Error("Bạn không có quyền admin.");
  }
  if (!res.ok) {
    throw new Error(`Không tải được danh sách nguồn (${res.status})`);
  }
  return (await res.json()) as AdminSourcesResponse;
}

export async function moderateAdminSource(
  sourceId: number,
  body: { action: "flag_spam" | "soft_delete" | "restore" | "adjust_categories"; category_ids?: number[] },
): Promise<void> {
  await ensureSanctumCsrf();
  const res = await fetch(`/admin/api/sources/${sourceId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Bạn không có quyền admin.");
  }
  if (!res.ok) {
    let msg = `Thao tác thất bại (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data.message) {
        msg = data.message;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function fetchPipelineStatus(params?: { startDate?: string; endDate?: string }): Promise<PipelineStatusData> {
  const search = new URLSearchParams();
  if (params?.startDate) {
    search.set("start_date", params.startDate);
  }
  if (params?.endDate) {
    search.set("end_date", params.endDate);
  }

  const res = await fetch(`/admin/api/pipeline/status${search.toString() ? `?${search.toString()}` : ""}`, {
    credentials: "same-origin",
    headers: getAuthHeaders(),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Bạn không có quyền admin.");
  }
  if (!res.ok) {
    throw new Error(`Không tải được trạng thái pipeline (${res.status})`);
  }
  const json = (await res.json()) as { data: PipelineStatusData };
  return json.data;
}