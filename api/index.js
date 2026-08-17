// server/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var encodeOAuthState = (state) => btoa(JSON.stringify(state));
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { randomUUID } from "node:crypto";
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

// drizzle/schema.ts
import { integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
var userRoleEnum = pgEnum("user_role", ["user", "admin"]);
var fixtureStatusEnum = pgEnum("fixture_status", ["scheduled", "live", "completed", "postponed", "cancelled"]);
var runTriggerEnum = pgEnum("run_trigger", ["scheduled", "manual"]);
var runStatusEnum = pgEnum("run_status", ["running", "success", "partial", "failed"]);
var users = pgTable("users", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull()
});
var tournaments = pgTable("tournaments", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  normalizedName: varchar("normalizedName", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
});
var fixtures = pgTable("fixtures", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  externalId: varchar("externalId", { length: 128 }).notNull().unique(),
  tournamentId: integer("tournamentId").notNull(),
  teamOne: varchar("teamOne", { length: 160 }).notNull(),
  teamTwo: varchar("teamTwo", { length: 160 }).notNull(),
  venue: varchar("venue", { length: 255 }),
  startTimeUtc: timestamp("startTimeUtc", { withTimezone: true }).notNull(),
  localDateGmt6: varchar("localDateGmt6", { length: 10 }).notNull(),
  localTimeGmt6: varchar("localTimeGmt6", { length: 5 }).notNull(),
  status: fixtureStatusEnum("status").default("scheduled").notNull(),
  scoreSummary: text("scoreSummary"),
  matchUrl: text("matchUrl"),
  bloggerPostId: varchar("bloggerPostId", { length: 128 }),
  bloggerPostUrl: text("bloggerPostUrl"),
  firstPublishedAt: timestamp("firstPublishedAt", { withTimezone: true }),
  lastPublishedAt: timestamp("lastPublishedAt", { withTimezone: true }),
  lastSyncedAt: timestamp("lastSyncedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
});
var publisherSettings = pgTable("publisher_settings", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  blogId: varchar("blogId", { length: 128 }).notNull().unique(),
  blogUrl: text("blogUrl").notNull(),
  boardPostUrl: text("boardPostUrl"),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  googleRefreshToken: text("googleRefreshToken"),
  oauthState: varchar("oauthState", { length: 128 }),
  lastRunAt: timestamp("lastRunAt", { withTimezone: true }),
  lastRunStatus: runStatusEnum("lastRunStatus"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
});
var publisherRuns = pgTable("publisher_runs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  trigger: runTriggerEnum("trigger").notNull(),
  status: runStatusEnum("status").notNull(),
  startedAt: timestamp("startedAt", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finishedAt", { withTimezone: true }),
  fixturesFetched: integer("fixturesFetched").default(0).notNull(),
  postsCreated: integer("postsCreated").default(0).notNull(),
  postsUpdated: integer("postsUpdated").default(0).notNull(),
  apiStatusCode: integer("apiStatusCode"),
  bloggerStatusCode: integer("bloggerStatusCode"),
  postUrls: text("postUrls"),
  errorMessage: text("errorMessage")
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  cricketDataApiKey: process.env.CRICKETDATA_API_KEY ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  bloggerBlogId: process.env.BLOGGER_BLOG_ID ?? "",
  bloggerRedirectUri: process.env.BLOGGER_REDIRECT_URI ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db) {
    const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
    if (!connectionString) return null;
    try {
      const client = postgres(connectionString, { prepare: false, max: 1 });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? /* @__PURE__ */ new Date() };
  const updateSet = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"]) {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = values[field];
    }
  }
  if (user.role !== void 0 || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function buildOAuthLoginUrl({ portalUrl, appId, redirectUri: redirectUri2, nonce }) {
  const url = new URL(`${portalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri2);
  url.searchParams.set("state", encodeOAuthState({ redirectUri: redirectUri2, nonce }));
  url.searchParams.set("type", "signIn");
  return url.toString();
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/start", (req, res) => {
    const portalUrl = process.env.VITE_OAUTH_PORTAL_URL || "https://manus.im";
    const appId = process.env.VITE_APP_ID || "K6DHitLuoyuvswsGGd4wCd";
    if (!appId) {
      res.status(500).json({ error: "OAuth app configuration is missing" });
      return;
    }
    const nonce = randomUUID();
    const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProtocol || req.protocol;
    const redirectUri2 = `${protocol}://${req.get("host")}/api/oauth/callback`;
    res.cookie(OAUTH_STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: protocol === "https",
      sameSite: "none",
      path: "/",
      maxAge: 10 * 60 * 1e3
    });
    res.redirect(302, buildOAuthLoginUrl({ portalUrl, appId, redirectUri: redirectUri2, nonce }));
  });
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/google-oauth.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { parse as parseCookieHeader3 } from "cookie";
var GOOGLE_STATE_COOKIE = "__Host-google_oauth_state";
var GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
var GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
var GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
var ONE_YEAR_MS2 = 365 * 24 * 60 * 60 * 1e3;
function getQueryParam2(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function getRedirectUri(req) {
  const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
  const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
  if (!host) throw new Error("OAuth host is missing");
  return `${protocol}://${host}/api/google/callback`;
}
function buildGoogleLoginUrl({ clientId, redirectUri: redirectUri2, nonce }) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri2);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", encodeOAuthState({ redirectUri: redirectUri2, nonce }));
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}
function registerGoogleOAuthRoutes(app) {
  app.get("/api/google/start", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      res.status(500).json({ error: "Google OAuth client is not configured" });
      return;
    }
    const nonce = randomUUID2();
    const redirectUri2 = getRedirectUri(req);
    res.cookie(GOOGLE_STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: redirectUri2.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60 * 1e3
    });
    res.redirect(302, buildGoogleLoginUrl({ clientId, redirectUri: redirectUri2, nonce }));
  });
  app.get("/api/google/callback", async (req, res) => {
    const code = getQueryParam2(req, "code");
    const state = getQueryParam2(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce, redirectUri: redirectUri2 } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader3(req.headers.cookie ?? "")[GOOGLE_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce || redirectUri2 !== getRedirectUri(req)) {
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
          redirect_uri: redirectUri2
        })
      });
      if (!tokenResponse.ok) throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
      const token = await tokenResponse.json();
      if (!token.access_token) throw new Error("Google access token missing");
      const userResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: { authorization: `Bearer ${token.access_token}` }
      });
      if (!userResponse.ok) throw new Error(`Google userinfo failed: ${userResponse.status}`);
      const userInfo = await userResponse.json();
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
      await upsertUser({
        openId,
        name: userInfo.name || email,
        email,
        loginMethod: "google",
        role: "admin",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(openId, {
        name: userInfo.name || email,
        expiresInMs: ONE_YEAR_MS2
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS2
      });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.status(500).json({ error: "Google OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { parse as parseCookie } from "cookie";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/publisher/db.ts
import { desc, eq as eq2 } from "drizzle-orm";
var DEFAULT_BLOG_URL = "https://watchnowcricket.blogspot.com";
async function getOrCreateSettings() {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await db.select().from(publisherSettings).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(publisherSettings).values({ blogId: "pending", blogUrl: DEFAULT_BLOG_URL });
  const created = await db.select().from(publisherSettings).limit(1);
  if (!created[0]) throw new Error("Unable to create publisher settings");
  return created[0];
}
async function getSettingsByTaskUid(taskUid) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const rows = await db.select().from(publisherSettings).where(eq2(publisherSettings.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}
async function saveScheduleTaskUid(taskUid) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const settings = await getOrCreateSettings();
  await db.update(publisherSettings).set({ scheduleCronTaskUid: taskUid }).where(eq2(publisherSettings.id, settings.id));
}
async function saveBoardPostUrl(boardPostUrl) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const settings = await getOrCreateSettings();
  await db.update(publisherSettings).set({ boardPostUrl }).where(eq2(publisherSettings.id, settings.id));
}
async function getBoardPostUrl() {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const settings = await getOrCreateSettings();
  return settings.boardPostUrl;
}
async function saveOAuthState(state) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const settings = await getOrCreateSettings();
  await db.update(publisherSettings).set({ oauthState: state }).where(eq2(publisherSettings.id, settings.id));
}
async function consumeOAuthState(state) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const settings = await getOrCreateSettings();
  if (!settings.oauthState || settings.oauthState !== state) return false;
  await db.update(publisherSettings).set({ oauthState: null }).where(eq2(publisherSettings.id, settings.id));
  return true;
}
async function saveBloggerCredentials(refreshToken, blogId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const settings = await getOrCreateSettings();
  await db.update(publisherSettings).set({ googleRefreshToken: refreshToken, blogId }).where(eq2(publisherSettings.id, settings.id));
}
async function upsertNormalizedFixture(fixture) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const normalizedName = fixture.tournamentName.trim().toLowerCase().replace(/\s+/g, " ");
  await db.insert(tournaments).values({ name: fixture.tournamentName, normalizedName }).onConflictDoUpdate({ target: tournaments.normalizedName, set: { name: fixture.tournamentName, updatedAt: /* @__PURE__ */ new Date() } });
  const tournament = await db.select().from(tournaments).where(eq2(tournaments.normalizedName, normalizedName)).limit(1);
  if (!tournament[0]) throw new Error(`Unable to resolve tournament ${fixture.tournamentName}`);
  await db.insert(fixtures).values({
    externalId: fixture.externalId,
    tournamentId: tournament[0].id,
    teamOne: fixture.teamOne,
    teamTwo: fixture.teamTwo,
    venue: fixture.venue,
    startTimeUtc: fixture.startTimeUtc,
    localDateGmt6: fixture.localDateGmt6,
    localTimeGmt6: fixture.localTimeGmt6,
    status: fixture.status,
    scoreSummary: fixture.scoreSummary,
    matchUrl: fixture.matchUrl,
    lastSyncedAt: /* @__PURE__ */ new Date()
  }).onConflictDoUpdate({
    target: fixtures.externalId,
    set: {
      tournamentId: tournament[0].id,
      teamOne: fixture.teamOne,
      teamTwo: fixture.teamTwo,
      venue: fixture.venue,
      startTimeUtc: fixture.startTimeUtc,
      localDateGmt6: fixture.localDateGmt6,
      localTimeGmt6: fixture.localTimeGmt6,
      status: fixture.status,
      scoreSummary: fixture.scoreSummary,
      matchUrl: fixture.matchUrl,
      lastSyncedAt: /* @__PURE__ */ new Date()
    }
  });
  const saved = await db.select().from(fixtures).where(eq2(fixtures.externalId, fixture.externalId)).limit(1);
  if (!saved[0]) throw new Error(`Unable to save fixture ${fixture.externalId}`);
  return saved[0];
}
async function saveBloggerPublication(fixtureId, postId, postUrl, firstPublishedAt) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(fixtures).set({ bloggerPostId: postId, bloggerPostUrl: postUrl, firstPublishedAt: firstPublishedAt ?? /* @__PURE__ */ new Date(), lastPublishedAt: /* @__PURE__ */ new Date() }).where(eq2(fixtures.id, fixtureId));
}
async function listRecentFixtures(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ fixture: fixtures, tournament: tournaments }).from(fixtures).innerJoin(tournaments, eq2(fixtures.tournamentId, tournaments.id)).orderBy(desc(fixtures.startTimeUtc)).limit(limit);
}
async function createRun(trigger) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(publisherRuns).values({ trigger, status: "running" }).returning({ id: publisherRuns.id });
  if (!result[0]) throw new Error("Unable to create publisher run");
  return result[0].id;
}
async function finishRun(id, values) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(publisherRuns).set({ ...values, finishedAt: /* @__PURE__ */ new Date() }).where(eq2(publisherRuns.id, id));
}
async function listRuns(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(publisherRuns).orderBy(desc(publisherRuns.startedAt)).limit(limit);
}

// server/publisher/blogger.ts
import crypto from "node:crypto";
var BLOGGER_SCOPE = "https://www.googleapis.com/auth/blogger";
var GOOGLE_TOKEN_URL2 = "https://oauth2.googleapis.com/token";
var BLOGGER_API = "https://www.googleapis.com/blogger/v3";
function requireOAuthConfig() {
  if (!ENV.googleClientId || !ENV.googleClientSecret) throw new Error("Google OAuth client settings are not configured");
}
function createOAuthState() {
  return crypto.randomBytes(24).toString("hex");
}
function getBloggerAuthorizationUrl(state, redirectUri2) {
  requireOAuthConfig();
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: redirectUri2,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: BLOGGER_SCOPE,
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
async function exchangeCode(code, redirectUri2) {
  requireOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL2, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri2,
      grant_type: "authorization_code"
    })
  });
  const body = await response.json();
  if (!response.ok || !body.access_token || !body.refresh_token) throw new Error(`Google token exchange failed: ${body.error ?? response.status}`);
  return body;
}
async function getAccessToken(refreshToken) {
  requireOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL2, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, refresh_token: refreshToken, grant_type: "refresh_token" })
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(`Google refresh failed: ${body.error ?? response.status}`);
  return body.access_token;
}
async function bloggerRequest(path, init, refreshToken) {
  const accessToken = await getAccessToken(refreshToken);
  const response = await fetch(`${BLOGGER_API}${path}`, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${accessToken}`, ...init.headers ?? {} }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Blogger request failed (${response.status}): ${body.error?.message ?? "unknown error"}`);
  return { body, statusCode: response.status };
}
async function completeBloggerAuthorization(code, redirectUri2) {
  const token = await exchangeCode(code, redirectUri2);
  const refreshToken = token.refresh_token;
  if (!refreshToken) throw new Error("Google authorization did not return a refresh token");
  const blog = await bloggerRequest(`/blogs/byurl?url=${encodeURIComponent("https://watchnowcricket.blogspot.com")}&fetchUserInfo=false`, { method: "GET" }, refreshToken);
  if (!blog.body.id) throw new Error("Google authorization succeeded, but the Watch Now Cricket blog could not be found");
  await saveBloggerCredentials(refreshToken, blog.body.id);
  return { blogId: blog.body.id, blogUrl: blog.body.url ?? "https://watchnowcricket.blogspot.com" };
}
async function getStoredBloggerSettings() {
  const settings = await getOrCreateSettings();
  if (settings.blogId === "pending" || !settings.googleRefreshToken) throw new Error("Blogger authorization is not complete");
  return settings;
}
function findMatchingBloggerPost(items, marker) {
  return items?.find((item) => item.content?.includes(marker)) ?? null;
}
async function findBloggerPostByMarker(marker, refreshToken) {
  const settings = await getStoredBloggerSettings();
  const response = await bloggerRequest(`/blogs/${encodeURIComponent(settings.blogId)}/posts/search?q=${encodeURIComponent(marker)}&fetchBodies=true`, { method: "GET" }, refreshToken);
  return findMatchingBloggerPost(response.body.items, marker);
}
async function createBloggerPost(title, content, labels, refreshToken) {
  const settings = await getStoredBloggerSettings();
  const response = await bloggerRequest(`/blogs/${encodeURIComponent(settings.blogId)}/posts/`, { method: "POST", body: JSON.stringify({ title, content, labels }) }, refreshToken);
  return { post: response.body, statusCode: response.statusCode };
}
async function updateBloggerPost(postId, title, content, labels, refreshToken) {
  const settings = await getStoredBloggerSettings();
  const response = await bloggerRequest(`/blogs/${encodeURIComponent(settings.blogId)}/posts/${encodeURIComponent(postId)}`, { method: "PUT", body: JSON.stringify({ id: postId, title, content, labels }) }, refreshToken);
  return { post: response.body, statusCode: response.statusCode };
}

// server/publisher/normalization.ts
var GMT6 = "Asia/Dhaka";
function dateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GMT6,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}
function normalizeStatus(status) {
  const value = (status ?? "scheduled").toLowerCase();
  if (value.includes("live") || value.includes("in progress")) return "live";
  if (value.includes("complete") || value.includes("result") || value.includes("finished")) return "completed";
  if (value.includes("postpon")) return "postponed";
  if (value.includes("cancel")) return "cancelled";
  return "scheduled";
}
function scoreText(score) {
  if (score == null) return null;
  if (typeof score === "string") return score.trim() || null;
  try {
    return JSON.stringify(score);
  } catch {
    return null;
  }
}
function normalizeFixture(input) {
  const start = new Date(input.dateTimeGMT ?? input.dateTime ?? "");
  if (Number.isNaN(start.getTime())) throw new Error("Provider fixture has an invalid start time");
  const parts = dateParts(start);
  const teams = input.teams?.length ? input.teams : input.teamInfo?.map((team) => team.name).filter(Boolean);
  return {
    externalId: String(input.id ?? `${input.name ?? "match"}-${start.toISOString()}`),
    tournamentName: input.league?.name?.trim() || "Other Matches",
    teamOne: teams?.[0]?.trim() || "TBC",
    teamTwo: teams?.[1]?.trim() || "TBC",
    venue: input.venue?.trim() || "Venue TBC",
    startTimeUtc: start,
    localDateGmt6: `${parts.year}-${parts.month}-${parts.day}`,
    localTimeGmt6: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`,
    status: normalizeStatus(input.status),
    scoreSummary: scoreText(input.score),
    matchUrl: input.matchUrl?.trim() || null
  };
}

// server/publisher/cricketdata.ts
var API_BASE = "https://api.cricapi.com/v1";
async function fetchFixtures() {
  if (!ENV.cricketDataApiKey) throw new Error("CRICKETDATA_API_KEY is not configured");
  const url = `${API_BASE}/matches?apikey=${encodeURIComponent(ENV.cricketDataApiKey)}&offset=0`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json();
  if (!response.ok || body.status === "failure") {
    throw new Error(`CricketData request failed (${response.status}): ${body.reason ?? "unknown provider error"}`);
  }
  const fixtures2 = (body.data ?? []).map(normalizeFixture);
  return { fixtures: fixtures2, statusCode: response.status };
}

// server/publisher/service.ts
var LOOKBACK_MS = 12 * 60 * 60 * 1e3;
var LOOKAHEAD_MS = 8 * 24 * 60 * 60 * 1e3;
var BOARD_MARKER = 'data-cricket-board="daily"';
function inPublishingWindow(fixture, now = Date.now()) {
  const start = fixture.startTimeUtc.getTime();
  return fixture.status === "live" || start >= now - LOOKBACK_MS && start <= now + LOOKAHEAD_MS;
}
function postTitle(fixture) {
  return `${fixture.teamOne} vs ${fixture.teamTwo} \u2014 ${fixture.localDateGmt6} ${fixture.localTimeGmt6} GMT+6`;
}
function postMarker(fixture) {
  return `data-cricket-fixture="${fixture.externalId}"`;
}
function postContent(fixture) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${fixture.teamOne} vs ${fixture.teamTwo}`,
    startDate: fixture.startTimeUtc.toISOString(),
    eventStatus: fixture.status === "cancelled" ? "https://schema.org/EventCancelled" : fixture.status === "completed" ? "https://schema.org/EventCompleted" : "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: fixture.venue },
    competitor: [{ "@type": "SportsTeam", name: fixture.teamOne }, { "@type": "SportsTeam", name: fixture.teamTwo }],
    sport: "Cricket"
  };
  const score = fixture.scoreSummary ? `<p><strong>Match status:</strong> ${fixture.scoreSummary}</p>` : `<p><strong>Match status:</strong> ${fixture.status}</p>`;
  const source = fixture.matchUrl ? `<p><a href="${fixture.matchUrl}" rel="nofollow noopener">View match details</a></p>` : "";
  return `<article class="cricket-match-post" ${postMarker(fixture)}><script type="application/ld+json">${JSON.stringify(structuredData)}</script><h1>${fixture.teamOne} vs ${fixture.teamTwo}</h1><p><strong>Tournament:</strong> ${fixture.tournamentName}</p><p><strong>Start time:</strong> ${fixture.localDateGmt6} at ${fixture.localTimeGmt6} GMT+6</p><p><strong>Venue:</strong> ${fixture.venue}</p>${score}${source}<p>Follow Watch Now Cricket for the latest fixture updates and match status.</p></article>`;
}
function fixtureMarker(fixture) {
  return `data-cricket-fixture="${fixture.externalId}"`;
}
function boardContent(rows) {
  const tableRows = rows.map((row) => `<tr><td>${row.fixture.localDateGmt6}</td><td>${row.fixture.localTimeGmt6}</td><td>${row.fixture.tournamentName}</td><td>${row.fixture.teamOne} vs ${row.fixture.teamTwo}</td><td>${row.postUrl ? `<a href="${row.postUrl}">Watch match post</a>` : "Pending"}</td></tr>`).join("");
  return `<section ${BOARD_MARKER}><h1>Daily Cricket Fixture Board</h1><p>Bangladesh time (GMT+6). Tournament-grouped fixtures and their individual match posts.</p><table><thead><tr><th>Date</th><th>Time</th><th>Tournament</th><th>Match</th><th>Details</th></tr></thead><tbody>${tableRows}</tbody></table></section>`;
}
async function runPublisher(trigger) {
  const runId = await createRun(trigger);
  let fixturesFetched = 0;
  let postsCreated = 0;
  let postsUpdated = 0;
  let apiStatusCode;
  let bloggerStatusCode;
  const postUrls = [];
  const boardRows = [];
  try {
    const [source, settings] = await Promise.all([fetchFixtures(), getStoredBloggerSettings()]);
    apiStatusCode = source.statusCode;
    const candidates = source.fixtures.filter((fixture) => inPublishingWindow(fixture));
    fixturesFetched = candidates.length;
    for (const normalized of candidates) {
      const saved = await upsertNormalizedFixture(normalized);
      const title = postTitle(normalized);
      const content = postContent(normalized);
      const labels = ["Cricket", normalized.tournamentName, normalized.localDateGmt6];
      const reconciledPost = saved.bloggerPostId ? null : await findBloggerPostByMarker(fixtureMarker(normalized), settings.googleRefreshToken);
      if (saved.bloggerPostId || reconciledPost) {
        const postId = saved.bloggerPostId ?? reconciledPost.id;
        const result = await updateBloggerPost(postId, title, content, labels, settings.googleRefreshToken);
        bloggerStatusCode = result.statusCode;
        if (reconciledPost && !saved.bloggerPostId) await saveBloggerPublication(saved.id, result.post.id, result.post.url ?? reconciledPost.url ?? null);
        if (result.post.url) postUrls.push(result.post.url);
        boardRows.push({ fixture: normalized, postUrl: result.post.url ?? reconciledPost?.url ?? null });
        postsUpdated += 1;
      } else {
        const result = await createBloggerPost(title, content, labels, settings.googleRefreshToken);
        bloggerStatusCode = result.statusCode;
        await saveBloggerPublication(saved.id, result.post.id, result.post.url ?? null);
        if (result.post.url) postUrls.push(result.post.url);
        boardRows.push({ fixture: normalized, postUrl: result.post.url ?? null });
        postsCreated += 1;
      }
    }
    const existingBoard = await findBloggerPostByMarker(BOARD_MARKER, settings.googleRefreshToken);
    const boardTitle = "Daily Cricket Fixture Board";
    const boardHtml = boardContent(boardRows);
    if (existingBoard) {
      const boardResult = await updateBloggerPost(existingBoard.id, boardTitle, boardHtml, ["Cricket", "homepage-board"], settings.googleRefreshToken);
      bloggerStatusCode = boardResult.statusCode;
      const boardUrl = boardResult.post.url ?? existingBoard.url;
      if (boardUrl) {
        await saveBoardPostUrl(boardUrl);
        postUrls.push(boardUrl);
      }
    } else {
      const boardResult = await createBloggerPost(boardTitle, boardHtml, ["Cricket", "homepage-board"], settings.googleRefreshToken);
      bloggerStatusCode = boardResult.statusCode;
      if (boardResult.post.url) {
        await saveBoardPostUrl(boardResult.post.url);
        postUrls.push(boardResult.post.url);
      }
    }
    await finishRun(runId, { status: "success", fixturesFetched, postsCreated, postsUpdated, apiStatusCode, bloggerStatusCode, postUrls: JSON.stringify(postUrls) });
    return { runId, status: "success", fixturesFetched, postsCreated, postsUpdated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(runId, { status: fixturesFetched > 0 ? "partial" : "failed", fixturesFetched, postsCreated, postsUpdated, apiStatusCode, bloggerStatusCode, postUrls: JSON.stringify(postUrls), errorMessage: message });
    throw error;
  }
}

// server/_core/heartbeat.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
var SERVICE = "webdevtoken.v1.WebDevService";
var buildEndpoint = (rpc) => {
  if (!ENV.forgeApiUrl) {
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service URL is not configured (BUILT_IN_FORGE_API_URL)."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service API key is not configured (BUILT_IN_FORGE_API_KEY)."
    });
  }
  const baseUrl = ENV.forgeApiUrl;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${SERVICE}/${rpc}`, normalizedBase).toString();
};
var callForge = async (rpc, body, userSession) => {
  const endpoint = buildEndpoint(rpc);
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${ENV.forgeApiKey}`,
    "content-type": "application/json",
    "connect-protocol-version": "1"
  };
  if (userSession) {
    headers["x-manus-user-session"] = userSession;
  }
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: `Heartbeat ${rpc} network error: ${String(error)}`
    });
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw mapForgeError(response, detail, rpc);
  }
  return await response.json();
};
var mapForgeError = (response, detail, rpc) => {
  const status = response.status;
  let code = "INTERNAL_SERVER_ERROR";
  if (status === 401) code = "UNAUTHORIZED";
  else if (status === 403) code = "FORBIDDEN";
  else if (status === 404) code = "NOT_FOUND";
  else if (status === 400 || status === 422) code = "BAD_REQUEST";
  else if (status === 409) code = "CONFLICT";
  else if (status === 429) code = "TOO_MANY_REQUESTS";
  return new TRPCError3({
    code,
    message: `Heartbeat ${rpc} failed (${status})${detail ? `: ${detail}` : ""}`
  });
};
var stringifyPayload = (payload) => {
  if (payload === void 0 || payload === null) return "{}";
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload);
};
var validateCallbackPath = (path) => {
  if (!path || !path.startsWith("/api/scheduled/")) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: "callback path must start with /api/scheduled/"
    });
  }
};
async function createHeartbeatJob(job, userSession) {
  validateCallbackPath(job.path);
  return callForge(
    "CreateHeartbeatJob",
    {
      name: job.name,
      cronExpression: job.cron,
      callbackPath: job.path,
      callbackMethod: job.method ?? "POST",
      callbackPayload: stringifyPayload(job.payload),
      description: job.description ?? ""
    },
    userSession
  );
}

// server/routers.ts
import { z as z2 } from "zod";
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  publisher: router({
    status: adminProcedure.query(async () => {
      try {
        const settings = await getStoredBloggerSettings();
        return { authorized: true, blogId: settings.blogId, blogUrl: settings.blogUrl };
      } catch {
        return { authorized: false, blogId: null, blogUrl: "https://watchnowcricket.blogspot.com" };
      }
    }),
    fixtures: adminProcedure.query(() => listRecentFixtures()),
    runs: adminProcedure.query(() => listRuns()),
    runNow: adminProcedure.mutation(() => runPublisher("manual")),
    scheduleDaily: adminProcedure.input(z2.object({ cron: z2.string().default("0 0 3 * * *") })).mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) throw new Error("Active session required to create the daily schedule");
      const job = await createHeartbeatJob({
        name: "cricket-daily-publisher",
        cron: input.cron,
        path: "/api/scheduled/publish-cricket",
        description: "Collect daily CricketData fixtures and publish one Blogger post per match."
      }, sessionToken);
      await saveScheduleTaskUid(job.taskUid);
      return job;
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/publisher/cron-auth.ts
function isValidCronAuthorization(expected, authorization) {
  return Boolean(expected && authorization === `Bearer ${expected}`);
}

// server/publisher/routes.ts
function redirectUri(req) {
  const protocol = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0];
  return `${protocol}://${req.get("host")}/api/blogger/oauth/callback`;
}
function registerPublisherRoutes(app) {
  app.get("/api/board", async (_req, res) => {
    try {
      const boardUrl = await getBoardPostUrl();
      if (!boardUrl) return res.status(404).send("The Daily Cricket Fixture Board has not been published yet.");
      return res.redirect(boardUrl);
    } catch (error) {
      return res.status(500).send(error instanceof Error ? error.message : "Unable to resolve the fixture board");
    }
  });
  app.get("/api/blogger/oauth/start", async (req, res) => {
    try {
      const state = createOAuthState();
      await saveOAuthState(state);
      res.redirect(getBloggerAuthorizationUrl(state, redirectUri(req)));
    } catch (error) {
      res.status(500).send(error instanceof Error ? error.message : "Unable to start Blogger authorization");
    }
  });
  app.get("/api/blogger/oauth/callback", async (req, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !state || !await consumeOAuthState(state)) return res.status(400).send("Invalid Blogger OAuth callback state");
      const result = await completeBloggerAuthorization(code, redirectUri(req));
      res.status(200).send(`Blogger authorization completed for ${result.blogUrl}. You may close this page.`);
    } catch (error) {
      res.status(500).send(error instanceof Error ? error.message : "Blogger authorization failed");
    }
  });
  app.get("/api/cron/publish-cricket", async (req, res) => {
    try {
      const expected = process.env.CRON_SECRET;
      const authorization = req.headers.authorization ?? "";
      if (!isValidCronAuthorization(expected, authorization)) {
        return res.status(401).json({ error: "Cron authentication required" });
      }
      const result = await runPublisher("scheduled");
      return res.json(result);
    } catch (error) {
      console.error("[Publisher] Vercel Cron run failed", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : "Cron publisher failed" });
    }
  });
  app.post("/api/scheduled/publish-cricket", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "Cron authentication required" });
      const settings = await getSettingsByTaskUid(user.taskUid);
      if (!settings) return res.json({ ok: true, skipped: "orphan" });
      const result = await runPublisher("scheduled");
      res.json(result);
    } catch (error) {
      console.error("[Publisher] Scheduled run failed", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Scheduled publisher failed" });
    }
  });
}

// server/app.ts
function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleOAuthRoutes(app);
  registerPublisherRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// api/entry.ts
var entry_default = createApp();
export {
  entry_default as default
};
