import type { Express, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { completeBloggerAuthorization, createOAuthState, getBloggerAuthorizationUrl } from "./blogger";
import { consumeOAuthState, getSettingsByTaskUid, saveOAuthState } from "./db";
import { runPublisher } from "./service";

function redirectUri(req: Request) {
  const protocol = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0];
  return `${protocol}://${req.get("host")}/api/blogger/oauth/callback`;
}

export function registerPublisherRoutes(app: Express) {
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
