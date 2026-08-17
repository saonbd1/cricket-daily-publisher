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

## REST migration deployment

- Latest REST migration deployment `6b9ac966` is Ready/Production at `https://cricket-daily-publisher-kgim5n7j7-saons-projects-c9a3d307.vercel.app`.
- Its public health endpoint returned `{"configured":false,"reachable":false}` with HTTP 503.
- Vercel Environment Variables still lists `SUPABASE_DB_PASSWORD`, `SUPABASE_URL`, and `SUPABASE_DB_REGION` for Production and Preview, but does not list `SUPABASE_SERVICE_ROLE_KEY`.
- The REST service-role secret validates locally with the existing read-only Supabase REST tests; it still needs to be added to Vercel Production/Preview and redeployed.

## Service-role redeploy verification

- Vercel now lists `SUPABASE_SERVICE_ROLE_KEY` for Production and Preview, added about two minutes before the latest check.
- A newer Production redeployment exists (`Redeploy of 2wuFdUXrw`), but its direct health endpoint still returns `{"configured":false,"reachable":false}`.
- The public alias also returns HTTP 503 with the same response. This indicates either the deployment is not receiving the project variable at runtime or the server bundle is reading a different environment mapping than expected.

## Diagnostic deployment result

- Vercel has now deployed checkpoint `be1e461` at `https://cricket-daily-publisher-p3qyq1u5d-saons-projects-c9a3d307.vercel.app`.
- Its health endpoint returns `{"urlValid":false,"keyPresent":true,"configured":false,"reachable":false}`.
- Therefore the service-role key is present in the Vercel runtime; only `SUPABASE_URL` is malformed or contains a dashboard/API URL rather than the project URL.
- Required format is `https://<project-ref>.supabase.co` (optional trailing slash only). No `/dashboard/...`, `/rest/v1`, quotes, or extra path should be included.
