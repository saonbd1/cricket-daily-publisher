import { ENV } from "../_core/env.js";
import { normalizeFixture, type NormalizedFixture, type ProviderFixture } from "./normalization.js";

const API_BASE = "https://api.cricapi.com/v1";
const PAGE_SIZE = 25;
// Paging deeper improves the odds of near-term matches surfacing (CricketData
// has no date filter — see below), but each page used to be its own
// sequential network round trip. At 30 pages that was enough, by itself, to
// blow past Vercel's 60s function limit — several scheduled/manual runs in
// early October died here before they'd even started publishing anything
// (fixturesFetched stuck at 0). Fetching in parallel batches cuts the
// worst-case wall time roughly by the batch size while keeping the same
// page depth, and the cap is pulled back in a bit as a second safety margin.
const MAX_PAGES = 20;
const BATCH_SIZE = 5;

type CricketDataResponse = {
  status?: string;
  reason?: string;
  data?: ProviderFixture[];
};

async function fetchPage(page: number) {
  const offset = page * PAGE_SIZE;
  const url = `${API_BASE}/matches?apikey=${encodeURIComponent(ENV.cricketDataApiKey)}&offset=${offset}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json() as CricketDataResponse;
  return { response, body };
}

export async function fetchFixtures(): Promise<{ fixtures: NormalizedFixture[]; statusCode: number; pagesFetched: number }> {
  if (!ENV.cricketDataApiKey) throw new Error("CRICKETDATA_API_KEY is not configured");
  const fixtures: NormalizedFixture[] = [];
  let statusCode = 200;
  let pagesFetched = 0;
  let reachedEnd = false;
  for (let batchStart = 0; batchStart < MAX_PAGES && !reachedEnd; batchStart += BATCH_SIZE) {
    const pages = Array.from(
      { length: Math.min(BATCH_SIZE, MAX_PAGES - batchStart) },
      (_, i) => batchStart + i,
    );
    const results = await Promise.all(pages.map(fetchPage));
    for (const { response, body } of results) {
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
      // Pages within a batch fire concurrently, so we can't stop mid-batch —
      // but once any page in the batch comes back short (the real end of
      // CricketData's offset-paginated data), there's nothing to gain from
      // the next batch.
      if (rows.length < PAGE_SIZE) reachedEnd = true;
    }
  }
  return { fixtures, statusCode, pagesFetched };
}
