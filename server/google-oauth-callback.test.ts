import express from "express";
import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME, decodeOAuthState } from "../shared/const.js";
import * as db from "./db.js";
import { registerGoogleOAuthRoutes } from "./_core/google-oauth.js";
import { sdk } from "./_core/sdk.js";

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  registerGoogleOAuthRoutes(app);
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not start");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function cookieValue(setCookie: string | null, name: string) {
  const match = setCookie?.match(new RegExp(`(?:^|,\\s*)${name}=([^;]+)`));
  return match?.[1] ?? "";
}

describe("Google OAuth callback", () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const originalAdminEmail = process.env.GOOGLE_ADMIN_EMAIL;

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = originalClientId;
    process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    process.env.GOOGLE_ADMIN_EMAIL = originalAdminEmail;
    vi.restoreAllMocks();
  });

  it("rejects a mismatched state before exchanging a code", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    await withServer(async baseUrl => {
      const start = await fetch(`${baseUrl}/api/google/start`, { redirect: "manual" });
      const location = start.headers.get("location");
      const state = new URL(location!).searchParams.get("state")!;
      const response = await fetch(`${baseUrl}/api/google/callback?code=test&state=${encodeURIComponent(state + "x")}`, {
        headers: { cookie: "__Host-google_oauth_state=wrong" },
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "invalid google oauth state" });
    });
  });

  it("rejects a verified Google account that is not the configured admin", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_ADMIN_EMAIL = "owner@example.com";
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 });
      }
      if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
        return new Response(JSON.stringify({ sub: "google-sub", email: "other@example.com", email_verified: true, name: "Other" }), { status: 200 });
      }
      return realFetch(input, init);
    });

    await withServer(async baseUrl => {
      const start = await fetch(`${baseUrl}/api/google/start`, { redirect: "manual" });
      const location = start.headers.get("location")!;
      const state = new URL(location).searchParams.get("state")!;
      const cookie = cookieValue(start.headers.get("set-cookie"), "__Host-google_oauth_state");
      const response = await fetch(`${baseUrl}/api/google/callback?code=test&state=${encodeURIComponent(state)}`, {
        headers: { cookie: `__Host-google_oauth_state=${cookie}` },
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Google account is not authorized for this dashboard" });
    });
  });

  it("creates an app session for the configured admin and redirects home", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_ADMIN_EMAIL = "owner@example.com";
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") return new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 });
      if (url === "https://openidconnect.googleapis.com/v1/userinfo") return new Response(JSON.stringify({ sub: "google-sub", email: "owner@example.com", email_verified: true, name: "Owner" }), { status: 200 });
      return realFetch(input, init);
    });
    vi.spyOn(db, "upsertUser").mockResolvedValue();
    const signedToken = await sdk.createSessionToken("google:google-sub", {
      name: "Owner",
      email: "owner@example.com",
      role: "admin",
    });
    vi.spyOn(sdk, "createSessionToken").mockResolvedValue(signedToken);
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue({
      id: 1,
      openId: "google:google-sub",
      name: "Owner",
      email: "owner@example.com",
      loginMethod: "google",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    await withServer(async baseUrl => {
      const start = await fetch(`${baseUrl}/api/google/start`, { redirect: "manual" });
      const location = start.headers.get("location")!;
      const state = new URL(location).searchParams.get("state")!;
      const decoded = decodeOAuthState(state);
      expect(decoded.redirectUri).toContain("/api/google/callback");
      const cookie = cookieValue(start.headers.get("set-cookie"), "__Host-google_oauth_state");
      const response = await fetch(`${baseUrl}/api/google/callback?code=test&state=${encodeURIComponent(state)}`, {
        redirect: "manual",
        headers: { cookie: `__Host-google_oauth_state=${cookie}` },
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/");
      const sessionCookie = response.headers.get("set-cookie");
      expect(sessionCookie).toContain(`${COOKIE_NAME}=${signedToken}`);
      expect(db.upsertUser).toHaveBeenCalledWith(expect.objectContaining({ openId: "google:google-sub", role: "admin" }));

      const authenticatedUser = await sdk.authenticateRequest({
        headers: { cookie: `${COOKIE_NAME}=${cookieValue(sessionCookie, COOKIE_NAME)}` },
      } as any);
      expect(authenticatedUser).toMatchObject({
        openId: "google:google-sub",
        email: "owner@example.com",
        role: "admin",
      });
    });
  });
});
