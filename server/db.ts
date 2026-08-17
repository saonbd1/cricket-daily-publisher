import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { InsertUser, users } from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";

let _db: ReturnType<typeof drizzle> | null = null;

function getConnectionString() {
  const explicit = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (explicit?.startsWith("postgres")) return explicit;
  if (!ENV.supabaseUrl || !ENV.supabaseDbPassword) return null;
  const projectRef = new URL(ENV.supabaseUrl).hostname.split(".")[0];
  const poolerHost = `aws-0-${ENV.supabaseDbRegion}.pooler.supabase.com`;
  return `postgresql://postgres.${projectRef}:${encodeURIComponent(ENV.supabaseDbPassword)}@${poolerHost}:6543/postgres`;
}

export async function getDb() {
  if (!_db) {
    const connectionString = getConnectionString();
    if (!connectionString) return null;
    try {
      const client = postgres(connectionString, { prepare: false, max: 1, ssl: "require" });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = values[field];
    }
  }
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
