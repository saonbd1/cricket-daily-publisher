import { describe, expect, it } from "vitest";

describe("production cron secret", () => {
  it.skipIf(process.env.RUN_PRODUCTION_CRON_SMOKE !== "1")("authenticates the production cron endpoint with CRON_SECRET", async () => {
    const secret = process.env.CRON_SECRET;
    expect(secret, "CRON_SECRET must be configured for this smoke test").toBeTruthy();

    const response = await fetch("https://cricket-daily-publisher.vercel.app/api/cron/publish-cricket", {
      headers: { Authorization: `Bearer ${secret}` },
    });

    expect(response.status, `production cron returned ${response.status}`).toBeGreaterThanOrEqual(200);
    expect(response.status, `production cron returned ${response.status}`).toBeLessThan(300);
  }, 120_000);
});
