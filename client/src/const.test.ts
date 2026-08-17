import { describe, expect, it } from "vitest";
import { decodeOAuthState } from "@shared/const";
import { buildLoginUrl, launchLogin } from "./const";

describe("frontend OAuth login launch", () => {
  it("builds the configured portal URL with the production callback", () => {
    const url = new URL(
      buildLoginUrl({
        portalUrl: "https://auth.example.test",
        appId: "cricket-app",
        origin: "https://cricket-daily-publisher.vercel.app",
        nonce: "nonce-123",
      }),
    );

    expect(url.origin).toBe("https://auth.example.test");
    expect(url.pathname).toBe("/app-auth");
    expect(url.searchParams.get("appId")).toBe("cricket-app");
    expect(url.searchParams.get("redirectUri")).toBe(
      "https://cricket-daily-publisher.vercel.app/api/oauth/callback",
    );
    expect(url.searchParams.get("type")).toBe("signIn");
    const decodedState = decodeOAuthState(url.searchParams.get("state") ?? "");
    expect(decodedState).toEqual({
      redirectUri: "https://cricket-daily-publisher.vercel.app/api/oauth/callback",
      nonce: "nonce-123",
    });
  });

  it("writes the nonce cookie and navigates when launching login", () => {
    const cookies: string[] = [];
    const navigations: string[] = [];

    launchLogin({
      portalUrl: "https://auth.example.test",
      appId: "cricket-app",
      origin: "https://cricket-daily-publisher.vercel.app",
      nonce: "nonce-456",
      setCookie: value => cookies.push(value),
      navigate: url => navigations.push(url),
    });

    expect(cookies).toEqual(["__Host-oauth_state=nonce-456; Path=/; Max-Age=600; SameSite=None; Secure"]);
    expect(navigations).toHaveLength(1);
    expect(new URL(navigations[0]).searchParams.get("appId")).toBe("cricket-app");
  });
});
