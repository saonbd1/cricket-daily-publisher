import { ENV } from "../_core/env.js";
import { normalizeFixture, type NormalizedFixture, type ProviderFixture } from "./normalization.js";

const API_BASE = "https://api.cricapi.com/v1";
const PAGE_SIZE = 25;
const MAX_PAGES = 12;

type CricketDataResponse = {
  status?: string;
  reason?: string;
  data?: ProviderFixture[];
};

export async function fetchFixtures(): Promise<{ fixtures: NormalizedFixture[]; statusCode: number; pagesFetched: number }> {
  if (!ENV.cricketDataApiKey) throw new Error("CRICKETDATA_API_KEY is not configured");
  const fixtures: NormalizedFixture[] = [];
  let statusCode = 200;
  let pagesFetched = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE_SIZE;
    const url = `${API_BASE}/matches?apikey=${encodeURIComponent(ENV.cricketDataApiKey)}&offset=${offset}`;
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const body = await response.json() as CricketDataResponse;
    statusCode = response.status;
    pagesFetched += 1;
    if (!response.ok || body.status === "failure") {
      throw new Error(`CricketData request failed (${response.status}): ${body.reason ?? "unknown provider error"}`);
    }
    const rows = body.data ?? [];
    for (const row of rows) {
      try {
        const normalized = normalizeFixture(row);
        normalized.sourceEvidence = ["cricketdata"];
        fixtures.push(normalized);
      } catch {
        // Ignore malformed provider rows and continue collecting valid pages.
      }
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return { fixtures, statusCode, pagesFetched };
}
