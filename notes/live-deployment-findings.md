# Live deployment findings

- Production project: `https://vercel.com/saons-projects-c9a3d307/cricket-daily-publisher`
- Public alias: `https://cricket-daily-publisher.vercel.app`
- Latest observed production commit: `5f0c1e07` (database health endpoint checkpoint).
- Vercel dashboard showed the production deployment as Ready and attached to `cricket-daily-publisher.vercel.app`.
- Before Supabase variables were added, `GET /api/health/database` returned `{\"configured\":false,\"reachable\":false}` in the authenticated browser.
- After variables were added and a redeploy was reported, the shell probe to `GET /api/health/database` timed out after 30 seconds with no response.
- Vercel logs showed `Invalid URL` from `getConnectionString` at `new URL(...)` and `password authentication failed for user \"postgres\"` during local validation of stale/new supplied values.
- Vercel logs also showed `/api/blogger/oauth/start` HTTP 500 and authenticated user lookup failures when the database was unavailable.
- Relevant source URL for Vercel logs: `https://vercel.com/saons-projects-c9a3d307/cricket-daily-publisher/logs`

## Reconnection check

- Vercel access is restored for the correct project/team.
- Production deployment is Ready and attached to `cricket-daily-publisher.vercel.app`.
- Environment Variables page lists `SUPABASE_DB_PASSWORD`, `SUPABASE_URL`, and `SUPABASE_DB_REGION`, each for Production and Preview.
- No `SUPABASE_DB_URL` variable is listed, so the stale explicit-URI hypothesis is not present in the visible Vercel project variables.
- The current visible Vercel deployment is still commit `5f0c1e0`, so the local connection-precedence fix has not been published yet.
