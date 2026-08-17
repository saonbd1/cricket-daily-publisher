import { randomUUID } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db.js";
import { COOKIE_NAME, encodeOAuthState, decodeOAuthState } from "../../shared/const.js";
import { getSessionCookieOptions } from "./cookies.js";
import { sdk } from "./sdk.js";

const GOOGLE_STATE_COOKIE = "__Host-google_oauth_state";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getRedirectUri(req: Request): string {
  const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
  const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
  if (!host) throw new Error("OAuth host is missing");
  return `${protocol}://${host}/api/google/callback`;
}

export function buildGoogleLoginUrl({ clientId, redirectUri, nonce }: { clientId: string; redirectUri: string; nonce: string }) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", encodeOAuthState({ redirectUri, nonce }));
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function registerGoogleOAuthRoutes(app: Express) {
  app.get("/api/google/start", (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      res.status(500).json({ error: "Google OAuth client is not configured" });
      return;
    }

    const nonce = randomUUID();
    const redirectUri = getRedirectUri(req);
    res.cookie(GOOGLE_STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: redirectUri.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(302, buildGoogleLoginUrl({ clientId, redirectUri, nonce }));
  });

  app.get("/api/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const { nonce, redirectUri } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[GOOGLE_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce || redirectUri !== getRedirectUri(req)) {
      res.status(403).json({ error: "invalid google oauth state" });
      return;
    }
    res.clearCookie(GOOGLE_STATE_COOKIE, { path: "/", secure: true, sameSite: "lax" });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(500).json({ error: "Google OAuth client is not configured" });
      return;
    }

    try {
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      if (!tokenResponse.ok) throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
      const token = (await tokenResponse.json()) as { access_token?: string };
      if (!token.access_token) throw new Error("Google access token missing");

      const userResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      if (!userResponse.ok) throw new Error(`Google userinfo failed: ${userResponse.status}`);
      const userInfo = (await userResponse.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      };
      if (!userInfo.sub || !userInfo.email || userInfo.email_verified !== true) {
        res.status(403).json({ error: "verified Google identity required" });
        return;
      }

      const email = userInfo.email.toLowerCase();
      const adminEmail = process.env.GOOGLE_ADMIN_EMAIL?.toLowerCase();
      if (!adminEmail || email !== adminEmail) {
        res.status(403).json({ error: "Google account is not authorized for this dashboard" });
        return;
      }

      const openId = `google:${userInfo.sub}`;
      await db.upsertUser({
        openId,
        name: userInfo.name || email,
        email,
        loginMethod: "google",
        role: "admin",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: userInfo.name || email,
        email,
        role: "admin",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.status(500).json({ error: "Google OAuth callback failed" });
    }
  });
}
