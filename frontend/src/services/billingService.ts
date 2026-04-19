import { authFetchHeaders, ensureSanctumCsrf } from "@/services/authService";

export type BillingPlan = "pro" | "power";

export type BillingCheckoutResult =
  | { kind: "redirect"; checkoutUrl: string }
  | { kind: "upgraded"; plan: BillingPlan; message?: string };

interface CheckoutEnvelope {
  data?: {
    checkout_url?: string;
    upgraded?: boolean;
    plan?: BillingPlan;
    message?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

/** Laravel có thể trả { data: { checkout_url } } hoặc thêm lớp bọc; một số endpoint có success, một số không. */
function extractCheckoutUrl(json: unknown): string | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const root = json as Record<string, unknown>;
  const data = root.data;
  const inner =
    data && typeof data === "object" && "data" in (data as Record<string, unknown>)
      ? (data as Record<string, unknown>).data
      : undefined;
  const candidates: unknown[] = [
    root.checkout_url,
    root.checkoutUrl,
    data && typeof data === "object" ? (data as Record<string, unknown>).checkout_url : undefined,
    data && typeof data === "object" ? (data as Record<string, unknown>).checkoutUrl : undefined,
    inner && typeof inner === "object" ? (inner as Record<string, unknown>).checkout_url : undefined,
    inner && typeof inner === "object" ? (inner as Record<string, unknown>).checkoutUrl : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) {
      return c;
    }
  }
  return null;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const json = (await response.json()) as {
      error?: { message?: string; code?: string } | string;
      message?: string;
    };
    let msg: string | undefined;
    if (typeof json.error === "string") {
      msg = json.error;
    } else if (json.error && typeof json.error === "object") {
      msg = json.error.message;
    }
    msg = msg ?? json.message;
    if (typeof msg === "string" && msg.length > 0) {
      return new Error(msg);
    }
  } catch {
    // Ignore non-JSON bodies.
  }

  return new Error(fallback);
}

interface UpgradeEnvelope {
  success?: boolean;
  message?: string;
  plan?: BillingPlan;
  data?: {
    upgraded?: boolean;
    plan?: BillingPlan;
    message?: string;
  };
}

/**
 * Pro → Power: cùng luồng Checkout (minh bạch proration). Ưu tiên dùng {@link startBillingCheckout}("power").
 */
export async function upgradeSubscriptionToPower(): Promise<BillingCheckoutResult> {
  await ensureSanctumCsrf();

  const response = await fetch("/api/subscriptions/upgrade", {
    method: "POST",
    headers: authFetchHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ plan: "power" }),
  });

  if (!response.ok) {
    throw await parseError(response, "Failed to upgrade subscription");
  }

  const json = (await response.json()) as UpgradeEnvelope & Record<string, unknown>;
  const checkoutUrl = extractCheckoutUrl(json);
  if (typeof checkoutUrl === "string" && checkoutUrl.length > 0) {
    return { kind: "redirect", checkoutUrl };
  }
  const data = json.data && typeof json.data === "object" ? (json.data as Record<string, unknown>) : undefined;
  if (json.success === true && data?.upgraded === true && data.plan === "power") {
    return {
      kind: "upgraded",
      plan: "power",
      message: typeof data.message === "string" ? data.message : typeof json.message === "string" ? json.message : undefined,
    };
  }

  throw new Error("Invalid upgrade response");
}

/**
 * Checkout (Free → Pro/Power hoặc Pro → Power).
 */
export async function startBillingCheckout(plan: BillingPlan): Promise<BillingCheckoutResult> {
  await ensureSanctumCsrf();

  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: authFetchHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ plan }),
  });

  if (!response.ok) {
    throw await parseError(response, "Failed to start billing");
  }

  const json = (await response.json()) as CheckoutEnvelope & Record<string, unknown>;
  const checkoutUrl = extractCheckoutUrl(json);
  if (typeof checkoutUrl === "string" && checkoutUrl.length > 0) {
    return { kind: "redirect", checkoutUrl };
  }

  const data = json.data && typeof json.data === "object" ? (json.data as CheckoutEnvelope["data"] & Record<string, unknown>) : undefined;
  if (data?.upgraded === true && data.plan === "power") {
    return {
      kind: "upgraded",
      plan: "power",
      message: typeof data.message === "string" ? data.message : undefined,
    };
  }

  throw new Error("Invalid billing response");
}

export async function createCheckoutSession(plan: BillingPlan): Promise<string> {
  const result = await startBillingCheckout(plan);
  if (result.kind === "redirect") {
    return result.checkoutUrl;
  }
  throw new Error("Expected Stripe Checkout redirect");
}

export interface BillingHistoryRow {
  id: number;
  date: string | null;
  description: string;
  amount: string;
  amount_cents: number;
  currency: string;
  status: string;
  invoice_url: string | null;
}

export interface BillingHistoryMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

interface HistoryEnvelope {
  data?: BillingHistoryRow[];
  meta?: BillingHistoryMeta;
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

async function parseHistoryError(response: Response, fallback: string): Promise<Error> {
  try {
    const json = (await response.json()) as HistoryEnvelope;
    const message = json.error?.message ?? json.message;
    if (typeof message === "string" && message.length > 0) {
      return new Error(message);
    }
  } catch {
    // Ignore non-JSON bodies.
  }

  return new Error(fallback);
}

/**
 * Tạo Stripe Billing Portal session để người dùng quản lý thẻ thanh toán, xem hóa đơn, v.v.
 * Trả về URL của portal — caller cần redirect đến đó.
 */
export async function openBillingPortal(): Promise<string> {
  await ensureSanctumCsrf();

  const response = await fetch("/api/billing/portal", {
    method: "POST",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw await parseError(response, "Failed to open billing portal");
  }

  const json = (await response.json()) as { data?: { portal_url?: string }; error?: { message?: string } };
  const url = json.data?.portal_url;
  if (typeof url === "string" && url.length > 0) {
    return url;
  }

  throw new Error("Could not get billing portal URL");
}

export async function fetchBillingHistory(params?: {
  page?: number;
  perPage?: number;
}): Promise<{ data: BillingHistoryRow[]; meta: BillingHistoryMeta }> {
  await ensureSanctumCsrf();

  const search = new URLSearchParams();
  if (params?.page && params.page > 1) {
    search.set("page", String(params.page));
  }
  if (params?.perPage && params.perPage > 0) {
    search.set("per_page", String(params.perPage));
  }

  const qs = search.toString();
  const response = await fetch(qs ? `/api/billing/history?${qs}` : "/api/billing/history", {
    method: "GET",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw await parseHistoryError(response, "Failed to load billing history");
  }

  const json = (await response.json()) as HistoryEnvelope;
  const data = Array.isArray(json.data) ? json.data : [];
  const meta = json.meta ?? {
    current_page: 1,
    per_page: 15,
    total: data.length,
    last_page: 1,
  };

  return { data, meta };
}
