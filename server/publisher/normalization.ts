const GMT6 = "Asia/Dhaka";

export type ProviderFixture = {
  id?: string | number;
  name?: string;
  dateTimeGMT?: string;
  dateTime?: string;
  league?: { name?: string };
  teams?: string[];
  teamInfo?: Array<{ name?: string }>;
  venue?: string;
  status?: string;
  score?: unknown;
  matchUrl?: string;
};

export type NormalizedFixture = {
  externalId: string;
  tournamentName: string;
  teamOne: string;
  teamTwo: string;
  venue: string;
  startTimeUtc: Date;
  localDateGmt6: string;
  localTimeGmt6: string;
  status: "scheduled" | "live" | "completed" | "postponed" | "cancelled";
  scoreSummary: string | null;
  matchUrl: string | null;
};

function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GMT6,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}

export function formatGmt6(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = dateParts(date);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: GMT6,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${formatted} GMT+6`;
}

function normalizeStatus(status?: string): NormalizedFixture["status"] {
  const value = (status ?? "scheduled").toLowerCase();
  if (value.includes("live") || value.includes("in progress")) return "live";
  if (value.includes("complete") || value.includes("result") || value.includes("finished")) return "completed";
  if (value.includes("postpon")) return "postponed";
  if (value.includes("cancel")) return "cancelled";
  return "scheduled";
}

function scoreText(score: unknown) {
  if (score == null) return null;
  if (typeof score === "string") return score.trim() || null;
  try {
    return JSON.stringify(score);
  } catch {
    return null;
  }
}

export function normalizeFixture(input: ProviderFixture): NormalizedFixture {
  const start = new Date(input.dateTimeGMT ?? input.dateTime ?? "");
  if (Number.isNaN(start.getTime())) throw new Error("Provider fixture has an invalid start time");
  const parts = dateParts(start);
  const teams = input.teams?.length ? input.teams : input.teamInfo?.map(team => team.name).filter(Boolean) as string[] | undefined;
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
    matchUrl: input.matchUrl?.trim() || null,
  };
}
