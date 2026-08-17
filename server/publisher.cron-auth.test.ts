import { describe, expect, it } from "vitest";
import { isValidCronAuthorization } from "./publisher/cron-auth";

describe("Vercel Cron authorization", () => {
  it("accepts the configured bearer token", () => {
    expect(isValidCronAuthorization("secret", "Bearer secret")).toBe(true);
  });

  it("rejects missing or incorrect credentials", () => {
    expect(isValidCronAuthorization(undefined, "Bearer secret")).toBe(false);
    expect(isValidCronAuthorization("secret", undefined)).toBe(false);
    expect(isValidCronAuthorization("secret", "secret")).toBe(false);
    expect(isValidCronAuthorization("secret", "Bearer other")).toBe(false);
  });
});
