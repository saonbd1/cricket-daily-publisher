import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { adminProcedure, publicProcedure, router } from "./_core/trpc.js";
import { listRecentFixtures, listRuns, listVerificationQueue } from "./publisher/db.js";
import { getStoredBloggerSettings } from "./publisher/blogger.js";
import { runPublisher } from "./publisher/service.js";
import { createHeartbeatJob } from "./_core/heartbeat.js";
import { saveScheduleTaskUid } from "./publisher/db.js";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
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
    verificationQueue: adminProcedure.query(() => listVerificationQueue()),
    runs: adminProcedure.query(() => listRuns()),
    runNow: adminProcedure.mutation(() => runPublisher("manual")),
    scheduleDaily: adminProcedure.input(z.object({ cron: z.string().default("0 0 3 * * *") })).mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) throw new Error("Active session required to create the daily schedule");
      const job = await createHeartbeatJob({
        name: "cricket-daily-publisher",
        cron: input.cron,
        path: "/api/scheduled/publish-cricket",
        description: "Collect daily CricketData fixtures and publish one Blogger post per match.",
      }, sessionToken);
      await saveScheduleTaskUid(job.taskUid);
      return job;
    }),
  }),
});

export type AppRouter = typeof appRouter;
