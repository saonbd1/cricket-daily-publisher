# Free cricket-data provider research — 2026-08-18

The comparison focuses on schedule completeness, structured fixture access, free limits, licensing/terms, reliability, and effort to integrate with the existing Vercel/Supabase publisher. Search discovery identified these candidates:

| Candidate | Evidence found | Initial fit |
|---|---|---|
| CricketData/CricAPI | Existing provider. Official documentation search result says the `offset` parameter must be changed to see additional records. Current app uses `/v1/matches?apikey=...&offset=0`, which returns a limited 25-record window in this audit. | First fix should be pagination/offset rather than immediate replacement. |
| Highlightly Cricket API | Official site/search result says every sport API has a free Basic tier with 100 requests/day; cricket coverage claims 900+ leagues across 80+ countries. | Promising low-volume fallback or cross-check; verify exact free endpoint, attribution, and fixture-history semantics. |
| TheSportsDB | Official site/search result describes a free JSON sports API and schedule API; it is crowd-sourced and may have uneven cricket coverage. | Useful supplemental source, but unlikely to be the sole authoritative daily cricket feed. |
| RapidAPI cricket listings | Search results show multiple free/freemium cricket APIs, including a “Cricket API Free Data” listing. | Marketplace terms, quotas, and upstream provenance vary; not suitable to select without opening the exact listing and checking current plan details. |
| Sportmonks Cricket API | Search result advertises a 14-day trial and paid plans, not a permanent free tier. | Not a cost-free long-term option. |
| DataSportsGroup / Sportradar / Goalserve / Entity Sports | Search results indicate commercial feeds or free trials. | Not cost-free long-term options. |
| Public Cricbuzz/ESPN pages | Public schedules are useful for manual cross-checks, but no official free public API was verified. Scraping may conflict with terms and is fragile. | Do not use as an automatic production source without explicit permission or an official API. |

The next research step is to open official documentation for CricketData offset behavior, Highlightly free-plan limits/endpoints, and TheSportsDB schedule APIs, then compare the data returned for 18 August 2026 before choosing a provider.

## Verified documentation findings

### Highlightly

Highlightly’s official cricket documentation states that the API base URL is `https://cricket.highlightly.net`. It documents cricket match endpoints under `Cricket.Matches` and explains that the response includes a `plan` object. The documentation warns that Basic/Free results may be hidden and exposes rate-limit headers such as `x-ratelimit-requests-limit` and `x-ratelimit-requests-remaining`. The documentation page also claims coverage across 900+ leagues/tournaments in 80+ countries. Source: https://highlightly.net/cricket-api/documentation/.

This makes Highlightly a credible low-volume cross-check candidate, but its free tier is explicitly filtered and therefore cannot yet be assumed to provide complete global fixtures.

### TheSportsDB

TheSportsDB’s official API guide states that a free API key `123` is available and that the free API retains core functionality while some methods are limited. The guide documents v1 schedule endpoints, while v2 schedule and livescore methods are described as premium-only. It also has a cricket-fixtures support section. Source: https://www.thesportsdb.com/docs_api_guide.

TheSportsDB is useful as a free supplemental source, but its crowd-sourced data model and free-tier method limits make it unsuitable as the sole source for complete, authoritative daily cricket fixtures without a coverage test.

## Coverage tests for the target date

TheSportsDB’s free documented endpoint `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=2026-08-18&s=Cricket` returned one event: Jamaica Kingsmen vs St Kitts and Nevis Patriots, Caribbean Premier League, at 23:00 UTC / 19:00 local. It did not return the Sri Lanka–India Test or the European qualifier matches found on Cricbuzz. This demonstrates that TheSportsDB’s free endpoint is usable but incomplete for the target day.

The current CricketData endpoint returned 25 records with the target-date-adjacent PNG Women–Thailand Women event and the later China Women–Oman Women event. Its official guide and search documentation reference the `offset` parameter for accessing additional records; the current collector should therefore paginate offsets before considering replacement. Sources: https://cricketdata.org/how-to-use-cricket-data-api.aspx and https://cricketdata.org/.

Highlightly was not live-tested because its API requires a user/API-key integration. Its official documentation confirms a Basic/Free tier can hide some results and exposes rate-limit headers, so it should be treated as a cross-check rather than assumed complete. Source: https://highlightly.net/cricket-api/documentation/.

## Recommendation

Use CricketData as the primary source, but change the collector to request multiple offsets until the provider reports no more records, then filter by a Bangladesh-time date window and deduplicate by stable match identity. Add a coverage diagnostic showing pages fetched, records returned, and target-date records found. Use Highlightly only as an optional second-source alert after the user supplies a key and accepts its free-tier filtering. Keep TheSportsDB as a free supplemental cross-check, not the primary source, because its real target-date response returned only one event. Do not scrape Cricbuzz or ESPN automatically without explicit permission and a terms review.

The provider-comparison conclusion is therefore: **no tested free replacement currently provides evidence of complete global daily coverage**. The lowest-risk cost-free improvement is to fix pagination and coverage diagnostics in the existing CricketData collector, then optionally cross-check with TheSportsDB or Highlightly.
