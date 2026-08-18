import { normalizeFixture, type NormalizedFixture } from "./normalization.js";

const API_BASE = "https://www.thesportsdb.com/api/v1/json/123";

type TheSportsDbEvent = {
  idEvent?: string;
  strTimestamp?: string;
  dateEvent?: string;
  strEvent?: string;
  strLeague?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strVenue?: string;
  strStatus?: string;
  strTime?: string;
};

type TheSportsDbResponse = { events?: TheSportsDbEvent[] | null };

export async function fetchTheSportsDbFixtures(localDateGmt6: string): Promise<{ fixtures: NormalizedFixture[]; statusCode: number }> {
  const url = `${API_BASE}/eventsday.php?d=${encodeURIComponent(localDateGmt6)}&s=Cricket`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json() as TheSportsDbResponse;
  if (!response.ok) throw new Error(`TheSportsDB request failed (${response.status})`);
  const fixtures = (body.events ?? []).flatMap((event) => {
    if (!event.strTimestamp || !event.strHomeTeam || !event.strAwayTeam) return [];
    try {
      return [normalizeFixture({
        id: `thesportsdb:${event.idEvent ?? event.strEvent}`,
        name: event.strEvent,
        dateTimeGMT: event.strTimestamp.endsWith("Z") ? event.strTimestamp : `${event.strTimestamp}Z`,
        league: { name: event.strLeague },
        teams: [event.strHomeTeam, event.strAwayTeam],
        venue: event.strVenue,
        status: event.strStatus,
      })];
    } catch {
      return [];
    }
  });
  return { fixtures, statusCode: response.status };
}
