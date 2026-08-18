import type { Fixture, PublisherRun, PublisherSettings, Tournament } from "../../drizzle/schema.js";
import { supabaseRest } from "../supabase-rest.js";
import type { NormalizedFixture } from "./normalization.js";

export const DEFAULT_BLOG_URL = "https://watchnowcricket.blogspot.com";

type FixtureWithTournament = { fixture: Fixture; tournament: Tournament };

async function getSettingsRows(query: Record<string, string | number | undefined> = {}) {
  return supabaseRest<PublisherSettings[]>("publisher_settings", {
    query: { select: "*", limit: 1, ...query },
  });
}

export async function getOrCreateSettings() {
  const existing = await getSettingsRows();
  if (existing[0]) return existing[0];
  const created = await supabaseRest<PublisherSettings[]>("publisher_settings", {
    method: "POST",
    body: [{ blogId: "pending", blogUrl: DEFAULT_BLOG_URL }],
    prefer: "return=representation",
  });
  if (!created[0]) throw new Error("Unable to create publisher settings");
  return created[0];
}

export async function getSettingsByTaskUid(taskUid: string) {
  const rows = await getSettingsRows({ scheduleCronTaskUid: `eq.${taskUid}` });
  return rows[0];
}

async function updateSettings(id: number, values: Record<string, unknown>) {
  await supabaseRest<PublisherSettings[]>("publisher_settings", {
    method: "PATCH",
    query: { id: `eq.${id}` },
    body: values,
    prefer: "return=representation",
  });
}

export async function saveScheduleTaskUid(taskUid: string) {
  const settings = await getOrCreateSettings();
  await updateSettings(settings.id, { scheduleCronTaskUid: taskUid, updatedAt: new Date().toISOString() });
}

export async function saveBoardPostUrl(boardPostUrl: string) {
  const settings = await getOrCreateSettings();
  await updateSettings(settings.id, { boardPostUrl, updatedAt: new Date().toISOString() });
}

export async function getBoardPostUrl() {
  const settings = await getOrCreateSettings();
  return settings.boardPostUrl;
}

export async function saveOAuthState(state: string) {
  const settings = await getOrCreateSettings();
  await updateSettings(settings.id, { oauthState: state, updatedAt: new Date().toISOString() });
}

export async function consumeOAuthState(state: string) {
  const settings = await getOrCreateSettings();
  if (!settings.oauthState || settings.oauthState !== state) return false;
  await updateSettings(settings.id, { oauthState: null, updatedAt: new Date().toISOString() });
  return true;
}

export async function saveBloggerCredentials(refreshToken: string, blogId: string) {
  const settings = await getOrCreateSettings();
  await updateSettings(settings.id, {
    googleRefreshToken: refreshToken,
    blogId,
    updatedAt: new Date().toISOString(),
  });
}

export async function upsertNormalizedFixture(fixture: NormalizedFixture) {
  const normalizedName = fixture.tournamentName.trim().toLowerCase().replace(/\s+/g, " ");
  const tournamentRows = await supabaseRest<Tournament[]>("tournaments", {
    method: "POST",
    query: { on_conflict: "normalizedName" },
    body: [{ name: fixture.tournamentName, normalizedName }],
    prefer: "resolution=merge-duplicates,return=representation",
  });
  const tournament = tournamentRows[0];
  if (!tournament) throw new Error(`Unable to resolve tournament ${fixture.tournamentName}`);

  const values = {
    externalId: fixture.externalId,
    tournamentId: tournament.id,
    teamOne: fixture.teamOne,
    teamTwo: fixture.teamTwo,
    venue: fixture.venue,
    startTimeUtc: fixture.startTimeUtc.toISOString(),
    localDateGmt6: fixture.localDateGmt6,
    localTimeGmt6: fixture.localTimeGmt6,
    status: fixture.status,
    scoreSummary: fixture.scoreSummary,
    matchUrl: fixture.matchUrl,
    verificationStatus: fixture.verificationStatus,
    sourceEvidence: JSON.stringify(fixture.sourceEvidence),
    lastSyncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const savedRows = await supabaseRest<Fixture[]>("fixtures", {
    method: "POST",
    query: { on_conflict: "externalId" },
    body: [values],
    prefer: "resolution=merge-duplicates,return=representation",
  });
  const saved = savedRows[0];
  if (!saved) throw new Error(`Unable to save fixture ${fixture.externalId}`);
  return saved;
}

export async function saveBloggerPublication(
  fixtureId: number,
  postId: string,
  postUrl: string | null,
  firstPublishedAt?: Date,
) {
  await supabaseRest<Fixture[]>("fixtures", {
    method: "PATCH",
    query: { id: `eq.${fixtureId}` },
    body: {
      bloggerPostId: postId,
      bloggerPostUrl: postUrl,
      firstPublishedAt: firstPublishedAt?.toISOString() ?? new Date().toISOString(),
      lastPublishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    prefer: "return=representation",
  });
}

export async function listVerificationQueue(limit = 100) {
  const rows = await supabaseRest<Array<Fixture & { tournament?: Tournament }>>("fixtures", {
    query: {
      select: "*,tournament:tournaments(*)",
      verificationStatus: "neq.verified",
      order: "updatedAt.desc",
      limit,
    },
  });
  return rows.filter((row) => row.tournament).map((row) => ({
    fixture: row,
    tournament: row.tournament!,
    sourceEvidence: row.sourceEvidence ? JSON.parse(row.sourceEvidence) as string[] : [],
  }));
}

export async function listRecentFixtures(limit = 100): Promise<FixtureWithTournament[]> {
  const rows = await supabaseRest<Array<Fixture & { tournament?: Tournament }>>("fixtures", {
    query: {
      select: "*,tournament:tournaments(*)",
      order: "startTimeUtc.desc",
      limit,
    },
  });
  return rows.flatMap((row) => (row.tournament ? [{ fixture: row, tournament: row.tournament }] : []));
}

export async function createRun(trigger: "scheduled" | "manual") {
  const rows = await supabaseRest<PublisherRun[]>("publisher_runs", {
    method: "POST",
    body: [{ trigger, status: "running" }],
    prefer: "return=representation",
  });
  if (!rows[0]) throw new Error("Unable to create publisher run");
  return rows[0].id;
}

export async function finishRun(id: number, values: Partial<PublisherRun>) {
  await supabaseRest<PublisherRun[]>("publisher_runs", {
    method: "PATCH",
    query: { id: `eq.${id}` },
    body: { ...values, finishedAt: new Date().toISOString() },
    prefer: "return=representation",
  });
}

export async function listRuns(limit = 20) {
  return supabaseRest<PublisherRun[]>("publisher_runs", {
    query: { select: "*", order: "startedAt.desc", limit },
  });
}
