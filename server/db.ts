import type { InsertUser, User } from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";
import { supabaseRest } from "./supabase-rest.js";

export function buildSupabasePoolerConnectionString(
  supabaseUrl: string | undefined,
  password: string | undefined,
  region: string,
) {
  if (!supabaseUrl || !password) return null;
  try {
    const parsed = new URL(supabaseUrl.trim());
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) return null;
    const projectRef = parsed.hostname.split(".")[0];
    if (!projectRef) return null;
    const poolerHost = `aws-0-${region}.pooler.supabase.com`;
    return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${poolerHost}:6543/postgres`;
  } catch {
    return null;
  }
}

export function buildUserUpsertValues(user: InsertUser, ownerOpenId = ENV.ownerOpenId) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const values: Record<string, unknown> = {
    openId: user.openId,
    lastSignedIn: (user.lastSignedIn ?? new Date()).toISOString(),
  };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) values[field] = user[field] ?? null;
  }
  if (user.role !== undefined || user.openId === ownerOpenId) {
    values.role = user.role ?? "admin";
  }
  return values;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  const values = buildUserUpsertValues(user);

  await supabaseRest<User[]>("users", {
    method: "POST",
    query: { on_conflict: "openId" },
    body: [values],
    prefer: "resolution=merge-duplicates,return=representation",
  });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const rows = await supabaseRest<User[]>("users", {
    query: { select: "*", openId: `eq.${openId}`, limit: 1 },
  });
  return rows[0];
}
