import { describe, expect, it } from "vitest";
import { isValidCronAuthorization } from "./publisher/cron-auth";

describe("configured Vercel cron secret", () => {
  it("accepts the configured bearer authorization shape", () => {
    const secret = process.env.CRON_SECRET;
    expect(secret, "CRON_SECRET must be configured for this production cron check").toBeTruthy();
    expect(isValidCronAuthorization(secret, `Bearer ${secret}`)).toBe(true);
    expect(isValidCronAuthorization(secret, "Bearer incorrect-secret")).toBe(false);
  });
});
