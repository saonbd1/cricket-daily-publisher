import dns from "node:dns/promises";
import postgres from "postgres";
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

  it("can reach the Supabase database with the project URL and database password", async () => {
    const projectUrl = process.env.SUPABASE_URL;
    const password = process.env.SUPABASE_DB_PASSWORD;
    expect(projectUrl).toMatch(/^https:\/\/[^/]+\.supabase\.co$/);
    expect(password).toBeTruthy();
    const ref = new URL(projectUrl!).hostname.split(".")[0];
    const host = "aws-0-ap-northeast-2.pooler.supabase.com";
    const address = await dns.lookup(host, { family: 4 });
    const connectionString = `postgresql://postgres.${ref}:${encodeURIComponent(password!)}@${address.address}:6543/postgres`;
    const client = postgres(connectionString, { prepare: false, max: 1, connect_timeout: 10, ssl: "require" });
    try {
      const result = await client`select 1 as ok`;
      expect(result[0]?.ok).toBe(1);
    } finally {
      await client.end({ timeout: 5 });
    }
  }, 20_000);
});
