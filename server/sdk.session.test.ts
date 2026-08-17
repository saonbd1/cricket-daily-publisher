import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db.js";
import { ENV } from "./_core/env.js";
import { SESSION_APP_ID_FALLBACK, sdk } from "./_core/sdk.js";

describe("signed dashboard sessions", () => {
  const originalAppId = ENV.appId;

  afterEach(() => {
    ENV.appId = originalAppId;
  });

  it("creates and verifies a session when the legacy app id is absent", async () => {
    ENV.appId = "";
    const token = await sdk.createSessionToken("google:test-sub", { name: "Owner" });
    const session = await sdk.verifySession(token);

    expect(session).toEqual({
      openId: "google:test-sub",
      appId: SESSION_APP_ID_FALLBACK,
      name: "Owner",
    });
  });

  it("authenticates the verified Google admin when the user lookup is unavailable", async () => {
    const token = await sdk.createSessionToken("google:test-sub", {
      name: "Owner",
      email: "owner@example.com",
      role: "admin",
    });
    vi.spyOn(db, "getUserByOpenId").mockRejectedValue(new Error("database unavailable"));

    const user = await sdk.authenticateRequest({
      headers: { cookie: `app_session_id=${token}` },
    } as any);

    expect(user).toMatchObject({
      openId: "google:test-sub",
      email: "owner@example.com",
      role: "admin",
      loginMethod: "google",
    });
  });
});
