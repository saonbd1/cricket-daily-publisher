import { ENV } from "./_core/env.js";

type RestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  prefer?: string;
};

function getRestBaseUrl() {
  const url = ENV.supabaseUrl.trim().replace(/\/$/, "");
  const key = ENV.supabaseServiceRoleKey;
  if (!/^https:\/\/[^/]+\.supabase\.co$/.test(url) || !key) return null;
  return `${url}/rest/v1`;
}

export function isSupabaseRestConfigured() {
  return getRestBaseUrl() !== null;
}

export async function supabaseRest<T>(table: string, options: RestOptions = {}): Promise<T> {
  const baseUrl = getRestBaseUrl();
  if (!baseUrl) throw new Error("Supabase REST is not configured");

  const url = new URL(`${baseUrl}/${table}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      apikey: ENV.supabaseServiceRoleKey,
      Authorization: `Bearer ${ENV.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer ?? "return=representation",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase REST ${response.status}: ${detail.slice(0, 300)}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function checkSupabaseRest() {
  if (!isSupabaseRestConfigured()) return { configured: false, reachable: false };
  try {
    await supabaseRest("users", { query: { select: "id", limit: 1 } });
    return { configured: true, reachable: true };
  } catch {
    return { configured: true, reachable: false };
  }
}
