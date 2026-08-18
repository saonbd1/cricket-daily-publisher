const response = await fetch(`https://api.cricapi.com/v1/matches?apikey=${encodeURIComponent(process.env.CRICKETDATA_API_KEY)}&offset=0`, { headers: { accept: "application/json" } });
const body = await response.json();
if (!response.ok || body.status === "failure") throw new Error(`CricketData request failed: ${response.status}`);
const fixtures = (body.data ?? []).map((item) => ({
  id: item.id ?? null,
  date: item.date ?? null,
  dateTimeGMT: item.dateTimeGMT ?? null,
  name: item.name ?? null,
  matchType: item.matchType ?? null,
  venue: item.venue ?? null,
  status: item.status ?? null,
  teams: item.teams ?? [],
  series_id: item.series_id ?? null,
}));
console.log(JSON.stringify({ status: body.status, count: fixtures.length, fixtures }, null, 2));
