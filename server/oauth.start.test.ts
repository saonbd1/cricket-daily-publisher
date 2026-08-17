import { describe, expect, it } from "vitest";
import { decodeOAuthState } from "../shared/const.js";
import { buildOAuthLoginUrl } from "./_core/oauth";

describe("OAuth start route contract", () => {
  it("builds a provider URL with a callback URI and matching state nonce", () => {
    const redirectUri = "https://cricket-daily-publisher.vercel.app/api/oauth/callback";
    const url = new URL(
      buildOAuthLoginUrl({
        portalUrl: "https://manus.im",
        appId: "cricket-app",
        redirectUri,
        nonce: "nonce-789",
      }),
    );

    expect(url.origin).toBe("https://manus.im");
    expect(url.pathname).toBe("/app-auth");
    expect(url.searchParams.get("appId")).toBe("cricket-app");
    expect(url.searchParams.get("redirectUri")).toBe(redirectUri);
    expect(url.searchParams.get("type")).toBe("signIn");
    expect(decodeOAuthState(url.searchParams.get("state") ?? "")).toEqual({
      redirectUri,
      nonce: "nonce-789",
    });
  });
});
