import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema.js";
import { sdk } from "./sdk.js";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures, but keep a safe
    // diagnostic so production failures are actionable without logging JWTs.
    const cookieHeader = opts.req.headers.cookie ?? "";
    console.warn("[Auth] Request authentication unavailable", {
      hasSessionCookie: cookieHeader.includes("app_session_id="),
      error: error instanceof Error ? error.message : String(error),
    });
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
