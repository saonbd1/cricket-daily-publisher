# Manual Vercel Cron Verification — 2026-08-19

## Trigger and authorization

At approximately 2026-08-19 11:40 UTC, the production endpoint `https://cricket-daily-publisher.vercel.app/api/cron/publish-cricket` was invoked with the configured `CRON_SECRET`. The gated Vitest smoke test passed and required a 2xx response. Earlier attempts returned 401 until `CRON_SECRET` was added to Vercel Production and redeployed.

## Production run record

Supabase project: `aktpjitqrxnpqjxxwydq` (Cricket Data Publisher).

Latest persisted `publisher_runs` record: id 7; trigger `scheduled`; status `partial`; started `2026-08-19 11:40:33.917548+00`; finished `2026-08-19 11:40:58.812+00`; fixtures fetched 28; posts created 0; posts updated 5; API status 200; Blogger status 200. Diagnostics: verified=5, candidates=23, conflicts=0, CricketData pages=12. The partial status is expected from the verified-only gate because secondary-only candidates remain held out of Blogger.

## Live Blogger verification

Homepage: https://watchnowcricket.blogspot.com/
Latest board post: https://watchnowcricket.blogspot.com/2026/08/daily-cricket-fixture-board_01801341783.html

The homepage rendered the latest Daily Cricket Fixture Board post timestamped `2026-08-19T04:40:58.023-07:00`, which is 11:40:58 UTC and aligns with the production run. The latest board contains five GMT+6 rows: Trinbago Knight Riders vs Saint Lucia Kings (2026-08-27 05:00), Antigua And Barbuda Falcons vs Guyana Amazon Warriors (2026-08-24 05:00), Antigua And Barbuda Falcons vs Trinbago Knight Riders (2026-08-23 05:00), Saint Lucia Kings vs Jamaica Kingsmen (2026-08-22 05:00), and Saint Lucia Kings vs Guyana Amazon Warriors (2026-08-20 05:00). Each row exposes a Watch match post link.

## Vercel evidence

Filtered Vercel logs: https://vercel.com/saons-projects-c9a3d307/cricket-daily-publisher/logs?live=true&search=requestPath%3A%2Fapi%2Fcron%2Fpublish-cricket

The logs showed the earlier 401 authorization failures and the earlier 500 schema-cache failure. After the Production secret and Supabase migration were corrected, the authenticated smoke test passed and Supabase persisted the successful partial run above.
