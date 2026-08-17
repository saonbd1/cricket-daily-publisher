import { describe, expect, it, vi } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies.js";

describe("session cookie options", () => {
  it("uses secure SameSite=Lax cookies in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const options = getSessionCookieOptions({
      protocol: "http",
      headers: { "x-forwarded-proto": "http" },
    } as any);

    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    vi.unstubAllEnvs();
  });

  it("allows secure cookies for HTTPS local requests", () => {
    vi.stubEnv("NODE_ENV", "development");
    const options = getSessionCookieOptions({
      protocol: "https",
      headers: {},
    } as any);

    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("lax");
    vi.unstubAllEnvs();
  });
});
