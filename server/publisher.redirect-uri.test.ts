import { describe, expect, it } from "vitest";
import { getBloggerRedirectUri } from "./publisher/routes.js";

describe("Blogger production redirect URI", () => {
  it("uses the forwarded HTTPS protocol and Vercel host", () => {
    const request = {
      headers: { "x-forwarded-proto": "https,https" },
      protocol: "http",
      get: (name: string) => (name.toLowerCase() === "host" ? "cricket-daily-publisher.vercel.app" : undefined),
    } as never;

    expect(getBloggerRedirectUri(request)).toBe(
      "https://cricket-daily-publisher.vercel.app/api/blogger/oauth/callback",
    );
  });

  it("uses the request protocol for local development", () => {
    const request = {
      headers: {},
      protocol: "http",
      get: (name: string) => (name.toLowerCase() === "host" ? "localhost:3000" : undefined),
    } as never;

    expect(getBloggerRedirectUri(request)).toBe("http://localhost:3000/api/blogger/oauth/callback");
  });
});
