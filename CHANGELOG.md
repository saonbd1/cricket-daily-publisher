# Changelog

Hand-maintained log of the issues found and fixes made to the publisher and
Blogger theme, in plain language. Newest first. (This starts from when match
previews were added — earlier history is in the git log.)

## 2026-10-08 — CricketData paging was timing out whole runs

**Issue:** Scheduled runs on Oct 5, 6 and 7, and a manual run on Oct 8, all
died silently — stuck at `status: "running"` forever, `fixturesFetched: 0`,
no error recorded. Root cause: the Oct 4 change that raised CricketData's
`MAX_PAGES` from 12 to 30 made `fetchFixtures()` do up to 30 *sequential*
network round-trips (one page at a time, awaited one after another) before
the run had published anything at all. That alone was enough to exceed
Vercel's 60-second function limit. When Vercel kills a function for running
too long, it's a hard infrastructure-level kill — the code's own try/catch
never runs, so the run never got marked "failed"; it just sat there as
"running" indefinitely. This was unrelated to the board-rebuild/429 fix
below; it was breaking runs before they ever reached that code.

**Fix:** `fetchFixtures()` (`server/publisher/cricketdata.ts`) now fetches
pages in parallel batches of 5 instead of one at a time, stopping as soon as
any page in a batch comes back short (the real end of the data). Worst-case
wall time drops roughly 5x for the same page depth. `MAX_PAGES` also pulled
back from 30 to 20, as a second margin — the Asian Games investigation
already established that paging deeper doesn't actually surface that
tournament (CricketData simply doesn't carry it), so there was no upside to
accepting the extra risk of the higher number.

**Cleanup:** manually marked the 4 orphaned "running" rows (ids 75, 77, 78,
79) as `failed` in the database so they stop showing as perpetually in
progress in the dashboard's run history.

## 2026-10-08 — Stale homepage board and Blogger 429 crashes

**Issue:** The homepage "Daily Cricket Fixture Board" table could go stale
for days while new match posts kept publishing normally. Cause: the board
was only rebuilt as the very last step of a run, after every fixture in that
run had been processed. If anything failed partway through the run (see
below), the board rebuild never ran at all — even though the individual
match posts before the failure had published successfully. The board was
also only ever built from the fixtures touched in that one run's fetch, not
from everything the database actually knew was published, so even a clean
run could quietly drop a fixture that didn't come back from that day's API
response.

**Fix:**
- The board is now rebuilt from the database's actual current state (every
  fixture with a live Blogger post inside the publishing window), not from
  whatever happened to be looped over in one run. It always reflects reality
  regardless of what that run did or didn't manage to touch.
- The per-fixture publish step now catches its own errors instead of letting
  one bad fixture crash the entire run. A failure is logged and counted, and
  the loop moves on to the next fixture. The board rebuild always runs
  afterward, no matter how many individual fixtures failed.

**Issue:** Runs were intermittently crashing with `Blogger request failed
(429): Resource has been exhausted`, visible to the user as a plain "500"
error with no further detail. Root cause: every fixture was re-sent to
Blogger on every run, even when nothing about it had changed (same teams,
venue, time — the vast majority of fixtures on any given day), which burned
through Blogger's API quota on repeat, no-op writes.

**Fix (minimizing Blogger API calls, as requested):**
- Each fixture's content (title + post body + search description) is hashed
  and compared against the hash stored from its last successful publish. If
  nothing changed, the Blogger call is skipped entirely — this is the main
  reduction, since most scheduled fixtures look identical run to run.
- A small delay (300ms) is now enforced between consecutive Blogger write
  calls to stay clear of its short-burst rate limit.
- A 429 response now gets one bounded retry after a short backoff before
  giving up on that fixture — most 429s are transient bursts, not a hard
  daily cap.
- The OAuth access token is now cached in-process for the lifetime of a run
  instead of being re-requested from Google before every single Blogger
  call, cutting a redundant round trip per call.
- Run diagnostics now report `created`, `updated`, `skipped (unchanged)`,
  and `failed` counts per run, plus whether the board rebuild itself
  succeeded — visible in the dashboard run history.

**Database:** added `fixtures.bloggerContentHash` (migration
`drizzle/0008_add_blogger_content_hash.sql`).

---

## 2026-10-04 — CricketData page depth increased

**Issue:** CricketData's `/matches` endpoint has no date filter at all — it
returns every match worldwide (international down to club-level domestic
cricket) with no way to scope it to "the next N days." Only paging 12 hits
deep (300 matches) meant a lot of near-term matches, including a 2026 Asian
Games cricket tournament match, likely fell outside that window and never
surfaced.

**Change:** `MAX_PAGES` raised from 12 to 30 (`server/publisher/cricketdata.ts`).
This improves the odds of near-term matches surfacing but is not a
guarantee — CricketData has no way to request "upcoming matches" directly.
Investigated the Asian Games match specifically: CricketData does not appear
to cover that tournament at all (it's an Olympic-style multi-sport event,
outside the bilateral-series/league coverage this provider focuses on).
Decision: not worth building a separate data source integration for an event
that occurs once every four years — documented here as a known, accepted gap
rather than chased further.

**Quota note:** this run's daily scheduled fetch now uses 30 of the free
tier's 100 daily CricketData hits, leaving less headroom for manual test
runs on the same day before hitting the quota.

## 2026-10-01 — Theme and SEO fixes

- **Duplicate `<h1>` tags, round 2:** the "Daily Cricket Fixture Board" post
  had its own hardcoded `<h1>` in its body content, on top of the site's
  header `<h1>` — fixed to `<h2>` (`boardContent()` in `service.ts`).
- **Page width:** narrowed the theme's max content width from 1180px to
  880px for a more comfortable reading measure.
- **Blogger Layout page showed nothing to configure:** the theme only
  defined one section, locked, with no "add gadget" area. Opened the main
  section up and added an empty addable section below the fixture feed so
  gadgets (Popular Posts, Labels, Search) can be added from Layout. The core
  match-feed widget itself stays locked — that's normal for every Blogger
  theme, not specific to this one.
- **Homepage showing many posts regardless of Blogger's "posts per page"
  setting:** that setting only controls *how many* posts show, not *which*
  ones, so it could never reliably show just the fixture table. Rewrote the
  homepage script to always fetch and render only the latest post labeled
  `homepage-board`, regardless of that setting.

## 2026-09-24 — Duplicate `<h1>`, SEO, model deprecation

- **Model deprecation:** Groq deprecated `llama-3.3-70b-versatile` for
  free/developer-tier accounts right as match previews were being tested,
  causing silent `null` previews (no error logged) and, once pagination
  piled up retries, request timeouts surfaced to the user as "not valid
  json". Switched `MATCH_PREVIEW_MODEL` to `openai/gpt-oss-20b`.
- **Duplicate `<h1>` tags, round 1:** every match post embedded its own
  `<h1>TeamA vs TeamB</h1>` in the body, on top of the theme's site-title
  `<h1>` in the header. Removed the in-body heading; the theme now renders
  exactly one `<h1>` per page — the post's own title on its permalink page,
  the site name everywhere else.
- **No meta description, ever:** Blogger posts weren't setting
  `searchDescription`, so every post shared one generic site-wide
  description in search results. Added `postSearchDescription()`, built
  from the preview text, wired into both create and update calls.
- **No Open Graph / Twitter Card tags:** sharing a match link on
  WhatsApp/Facebook/X showed no title, description, or preview. Added
  `og:*` and `twitter:*` meta tags to the theme, conditioned on post vs.
  non-post pages.

## 2026-09-23 — Match preview feature added

- New `server/publisher/preview.ts`: generates a short, factual 3–4
  sentence match preview per fixture using the existing (previously unused)
  OpenAI-compatible LLM client in `server/_core/llm.ts`, pointed at Groq.
  Explicitly instructed not to invent scores, stats, players, or a winner.
  Generated once per fixture and cached — never regenerated on later runs.
- Wired into `postContent()` as a "Match Preview" section on each match
  post.
- **Database:** added `fixtures.previewText`, `fixtures.previewGeneratedAt`
  (migration `drizzle/0007_add_match_preview.sql`).
- **New env vars (optional — publisher skips previews cleanly if unset):**
  `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `MATCH_PREVIEW_MODEL`.
