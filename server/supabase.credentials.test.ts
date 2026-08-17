import { describe, expect, it } from "vitest";

describe("Supabase server credentials", () => {
  it("can reach the configured Supabase REST endpoint with the service role key", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(url).toMatch(/^https:\/\/[^/]+\.supabase\.co$/);
    expect(key).toBeTruthy();
    const response = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key!, Authorization: `Bearer ${key!}` },
    });
    expect(response.status).toBeLessThan(500);
  });
});
