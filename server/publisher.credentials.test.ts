import { describe, expect, it } from "vitest";

const cricketDataKey = process.env.CRICKETDATA_API_KEY ?? "";
const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

describe("publisher credentials", () => {
  it("has the Google OAuth client settings", () => {
    expect(googleClientId.length).toBeGreaterThan(10);
    expect(googleClientSecret.length).toBeGreaterThan(10);
  });

  it("accepts the CricketData API key on the lightweight current-matches call", async () => {
    expect(cricketDataKey.length).toBeGreaterThan(10);
    const response = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(cricketDataKey)}&offset=0`);
    expect(response.status).toBeLessThan(500);
    const body = await response.json() as { status?: string; reason?: string };
    expect(body.status).not.toBe("failure");
  }, 20_000);
});
