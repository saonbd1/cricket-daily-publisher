import { ENV } from "../_core/env";
import { normalizeFixture, type NormalizedFixture, type ProviderFixture } from "./normalization";

const API_BASE = "https://api.cricapi.com/v1";

type CricketDataResponse = {
  status?: string;
  reason?: string;
  data?: ProviderFixture[];
};

export async function fetchFixtures(): Promise<{ fixtures: NormalizedFixture[]; statusCode: number }> {
  if (!ENV.cricketDataApiKey) throw new Error("CRICKETDATA_API_KEY is not configured");
  const url = `${API_BASE}/matches?apikey=${encodeURIComponent(ENV.cricketDataApiKey)}&offset=0`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json() as CricketDataResponse;
  if (!response.ok || body.status === "failure") {
    throw new Error(`CricketData request failed (${response.status}): ${body.reason ?? "unknown provider error"}`);
  }
  const fixtures = (body.data ?? []).map(normalizeFixture);
  return { fixtures, statusCode: response.status };
}
