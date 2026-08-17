import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { sdk } from "../_core/sdk.js";
import { completeBloggerAuthorization, createOAuthState, getBloggerAuthorizationUrl } from "./blogger.js";
import { getDb } from "../db.js";
import { consumeOAuthState, getBoardPostUrl, getSettingsByTaskUid, saveOAuthState } from "./db.js";
import { runPublisher } from "./service.js";
import { isValidCronAuthorization } from "./cron-auth.js";

function redirectUri(req: Request) {
  const protocol = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0];
  return `${protocol}://${req.get("host")}/api/blogger/oauth/callback`;
}

export function registerPublisherRoutes(app: Express) {
  app.get("/api/health/database", async (_req: Request, res: Response) => {
    const db = await getDb();
    if (!db) return res.json({ configured: false, reachable: false });
    try {
      await db.execute(sql`select 1`);
      return res.json({ configured: true, reachable: true });
    } catch (error) {
      console.error("[Database] Health check failed", error);
      return res.status(503).json({ configured: true, reachable: false });
    }
  });

  app.get("/api/board", async (_req: Request, res: Response) => {
    try {
      const boardUrl = await getBoardPostUrl();
      if (!boardUrl) return res.status(404).send("The Daily Cricket Fixture Board has not been published yet.");
      return res.redirect(boardUrl);
    } catch (error) {
      return res.status(500).send(error instanceof Error ? error.message : "Unable to resolve the fixture board");
    }
  });

  app.get("/api/blogger/oauth/start", async (req: Request, res: Response) => {
    try {
      const state = createOAuthState();
      await saveOAuthState(state);
      res.redirect(getBloggerAuthorizationUrl(state, redirectUri(req)));
    } catch (error) {
      res.status(500).send(error instanceof Error ? error.message : "Unable to start Blogger authorization");
    }
  });

  app.get("/api/blogger/oauth/callback", async (req: Request, res: Response) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !state || !(await consumeOAuthState(state))) return res.status(400).send("Invalid Blogger OAuth callback state");
      const result = await completeBloggerAuthorization(code, redirectUri(req));
      res.status(200).send(`Blogger authorization completed for ${result.blogUrl}. You may close this page.`);
    } catch (error) {
      res.status(500).send(error instanceof Error ? error.message : "Blogger authorization failed");
    }
  });

  app.get("/api/cron/publish-cricket", async (req: Request, res: Response) => {
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

  app.post("/api/scheduled/publish-cricket", async (req: Request, res: Response) => {
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
