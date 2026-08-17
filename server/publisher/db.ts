import { and, desc, eq } from "drizzle-orm";
import { fixtures, publisherRuns, publisherSettings, tournaments } from "../../drizzle/schema";
import { getDb } from "../db";
import type { NormalizedFixture } from "./normalization";

export const DEFAULT_BLOG_URL = "https://watchnowcricket.blogspot.com";

export async function getOrCreateSettings() {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await db.select().from(publisherSettings).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(publisherSettings).values({ blogId: "pending", blogUrl: DEFAULT_BLOG_URL });
  const created = await db.select().from(publisherSettings).limit(1);
  if (!created[0]) throw new Error("Unable to create publisher settings");
  return created[0];
}

export async function getSettingsByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const rows = await db.select().from(publisherSettings).where(eq(publisherSettings.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}

export async function saveScheduleTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const settings = await getOrCreateSettings();
  await db.update(publisherSettings).set({ scheduleCronTaskUid: taskUid }).where(eq(publisherSettings.id, settings.id));
}

export async function saveOAuthState(state: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const settings = await getOrCreateSettings();
  await db.update(publisherSettings).set({ oauthState: state }).where(eq(publisherSettings.id, settings.id));
}

export async function consumeOAuthState(state: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const settings = await getOrCreateSettings();
  if (!settings.oauthState || settings.oauthState !== state) return false;
  await db.update(publisherSettings).set({ oauthState: null }).where(eq(publisherSettings.id, settings.id));
  return true;
}

export async function saveBloggerCredentials(refreshToken: string, blogId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const settings = await getOrCreateSettings();
  await db.update(publisherSettings).set({ googleRefreshToken: refreshToken, blogId }).where(eq(publisherSettings.id, settings.id));
}

export async function upsertNormalizedFixture(fixture: NormalizedFixture) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const normalizedName = fixture.tournamentName.trim().toLowerCase().replace(/\s+/g, " ");
  await db.insert(tournaments).values({ name: fixture.tournamentName, normalizedName }).onDuplicateKeyUpdate({ set: { name: fixture.tournamentName } });
  const tournament = await db.select().from(tournaments).where(eq(tournaments.normalizedName, normalizedName)).limit(1);
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
    lastSyncedAt: new Date(),
  }).onDuplicateKeyUpdate({
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
      lastSyncedAt: new Date(),
    },
  });
  const saved = await db.select().from(fixtures).where(eq(fixtures.externalId, fixture.externalId)).limit(1);
  if (!saved[0]) throw new Error(`Unable to save fixture ${fixture.externalId}`);
  return saved[0];
}

export async function saveBloggerPublication(fixtureId: number, postId: string, postUrl: string | null, firstPublishedAt?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(fixtures).set({ bloggerPostId: postId, bloggerPostUrl: postUrl, firstPublishedAt: firstPublishedAt ?? new Date(), lastPublishedAt: new Date() }).where(eq(fixtures.id, fixtureId));
}

export async function listRecentFixtures(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ fixture: fixtures, tournament: tournaments }).from(fixtures).innerJoin(tournaments, eq(fixtures.tournamentId, tournaments.id)).orderBy(desc(fixtures.startTimeUtc)).limit(limit);
}

export async function createRun(trigger: "scheduled" | "manual") {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(publisherRuns).values({ trigger, status: "running" });
  return Number(result[0].insertId);
}

export async function finishRun(id: number, values: Partial<typeof publisherRuns.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(publisherRuns).set({ ...values, finishedAt: new Date() }).where(eq(publisherRuns.id, id));
}

export async function listRuns(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(publisherRuns).orderBy(desc(publisherRuns.startedAt)).limit(limit);
}
