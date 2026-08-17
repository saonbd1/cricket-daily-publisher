import { describe, expect, it } from "vitest";

describe("CricketData credentials", () => {
  it("accepts the configured API key for a read-only matches request", async () => {
    const apiKey = process.env.CRICKETDATA_API_KEY ?? "";
    expect(apiKey, "CRICKETDATA_API_KEY must be configured for this validation").toBeTruthy();

    const response = await fetch(`https://api.cricapi.com/v1/matches?apikey=${encodeURIComponent(apiKey)}&offset=0`);
    const body = await response.json() as { status?: string; reason?: string };

    expect(response.ok, body.reason ?? `CricketData returned HTTP ${response.status}`).toBe(true);
    expect(body.status).not.toBe("failure");
  }, 20_000);
});
