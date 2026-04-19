import { authFetchHeaders, ensureSanctumCsrf } from "@/services/authService";

export interface SettingsData {
  profile: {
    display_name: string | null;
    x_username: string;
    email: string | null;
    avatar_url: string | null;
  };
  preferences: {
    my_categories: number[];
    email_digest_enabled: boolean;
    email_digest_time: string;
    locale: "en" | "vi" | string;
  };
  plan: {
    current: "free" | "pro" | "power" | string;
    features: string[];
    subscription_ends_at?: string | null;
  };
  telegram: {
    connected: boolean;
    chat_id: string | null;
    connect_token: string;
  };
}

export interface SettingsUpdatePayload {
  display_name?: string;
  email?: string;
  email_digest_enabled?: boolean;
  email_digest_time?: string;
  my_categories?: number[];
  locale?: string;
}

interface SettingsEnvelope {
  data: SettingsData;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const json = (await response.json()) as { message?: string };
    if (typeof json.message === "string" && json.message.length > 0) {
      return new Error(json.message);
    }
  } catch {
    // Ignore non-JSON bodies.
  }

  return new Error(fallback);
}

export async function fetchSettings(): Promise<SettingsData> {
  await ensureSanctumCsrf();

  const response = await fetch("/api/settings", {
    method: "GET",
    headers: authFetchHeaders(),
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw await parseError(response, "Failed to fetch settings");
  }

  const json = (await response.json()) as SettingsEnvelope;
  if (!json.data) {
    throw new Error("Invalid settings response");
  }

  return json.data;
}

export async function updateSettings(payload: SettingsUpdatePayload): Promise<SettingsData> {
  await ensureSanctumCsrf();

  const response = await fetch("/api/settings", {
    method: "PATCH",
    headers: authFetchHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await parseError(response, "Failed to update settings");
  }

  const json = (await response.json()) as SettingsEnvelope;
  if (!json.data) {
    throw new Error("Invalid settings response");
  }

  return json.data;
}
