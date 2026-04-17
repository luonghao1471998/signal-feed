import { authFetchHeaders, ensureSanctumCsrf } from "@/services/authService";

export type BillingPlan = "pro" | "power";

interface CheckoutEnvelope {
  data?: {
    checkout_url?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const json = (await response.json()) as CheckoutEnvelope;
    const message = json.error?.message ?? json.message;
    if (typeof message === "string" && message.length > 0) {
      return new Error(message);
    }
  } catch {
    // Ignore non-JSON bodies.
  }

  return new Error(fallback);
}

export async function createCheckoutSession(plan: BillingPlan): Promise<string> {
  await ensureSanctumCsrf();

  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: authFetchHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ plan }),
  });

  if (!response.ok) {
    throw await parseError(response, "Failed to create checkout session");
  }

  const json = (await response.json()) as CheckoutEnvelope;
  const checkoutUrl = json.data?.checkout_url;
  if (typeof checkoutUrl !== "string" || checkoutUrl.length === 0) {
    throw new Error("Invalid checkout response");
  }

  return checkoutUrl;
}
