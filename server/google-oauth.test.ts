import { describe, expect, it } from "vitest";
import { buildGoogleLoginUrl } from "./_core/google-oauth.js";
import { decodeOAuthState } from "../shared/const.js";

describe("Google OAuth dashboard login", () => {
  it("builds a state-bound Google authorization URL", () => {
    const redirectUri = "https://cricket-daily-publisher.vercel.app/api/google/callback";
    const url = new URL(
      buildGoogleLoginUrl({
        clientId: "client-id",
        redirectUri,
        nonce: "nonce-123",
      }),
    );

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(url.searchParams.get("scope")).toContain("openid");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("scope")).toContain("profile");

    const state = decodeOAuthState(url.searchParams.get("state") ?? "");
    expect(state.redirectUri).toBe(redirectUri);
    expect(state.nonce).toBe("nonce-123");
  });
});
