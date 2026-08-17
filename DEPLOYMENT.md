# Cricket Daily Publisher: Supabase and Vercel Deployment

This service collects CricketData.org fixtures, normalizes them to Bangladesh Standard Time (GMT+6), and publishes idempotent Blogger match posts. The production API can run as a Vercel serverless function backed by the Supabase PostgreSQL project.

## Required server environment variables

| Variable | Purpose | Where to obtain it | Exposure |
|---|---|---|---|
| `SUPABASE_URL` | Supabase project REST/database endpoint | Supabase Project Settings → API | Server-only; never use as a client `VITE_` variable |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side database access for publisher persistence | Supabase Project Settings → API | Highly sensitive; server-only, never expose in browser code |
| `CRICKETDATA_API_KEY` | CricketData.org fixture collection | CricketData.org account/API settings | Server-only |
| `GOOGLE_CLIENT_ID` | Google OAuth Web application client ID | Google Cloud Console → APIs & Services → Credentials | Server-only for this backend |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Web application client secret | Google Cloud Console → APIs & Services → Credentials | Highly sensitive; server-only |
| `BLOGGER_BLOG` | Optional numeric Blogger blog ID | Leave blank initially; the authorized callback discovers it from the configured Blogspot account | Server-only |
| `JWT_SECRET` | Session signing secret used by the application shell | Project secret management | Highly sensitive; server-only |

Do not commit `.env` files, service-role keys, OAuth client secrets, or API keys. Add each value in Vercel Project Settings → Environment Variables for Production and Preview as appropriate, then redeploy.

## Vercel routes

The serverless entrypoint is `api/index.ts`, routed by `vercel.json`. The important endpoints are:

- `GET /api/blogger/oauth/start` starts Blogger authorization.
- `GET /api/blogger/oauth/callback` receives the Google callback and persists the refresh token.
- `POST /api/scheduled/publish-cricket` runs the authenticated scheduled publisher.
- `/api/trpc/*` serves the protected dashboard procedures.

After Vercel assigns the production domain, add this exact redirect URI to the Google Cloud OAuth Web application client:

```text
https://<your-vercel-domain>/api/blogger/oauth/callback
```

The OAuth consent screen must include the Blogger read/write scope required by the publisher. Keep the app in testing or production according to the Google Cloud account’s verification requirements, and add the owner account as a test user when the app is in testing.

## Supabase

The active project is named **Cricket Data Publisher**. The publisher tables are created by the reviewed Supabase migration. Do not run destructive Drizzle migrations against the existing Supabase project without comparing the generated SQL to the live schema first.

## Scheduling

Vercel does not provide the Manus Heartbeat identity automatically. Use an external daily cron provider or a Vercel-compatible scheduled trigger to send a POST request to `/api/scheduled/publish-cricket`. The endpoint must be protected with a deployment secret or an equivalent authenticated trigger after the external schedule is selected; do not make the publishing endpoint publicly callable without authentication.
