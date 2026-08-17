# Cricket Daily Publisher: Supabase and Vercel Deployment

This service collects CricketData.org fixtures, normalizes them to Bangladesh Standard Time (GMT+6), and publishes idempotent Blogger match posts. The production API can run as a Vercel serverless function backed by the Supabase PostgreSQL project.

## Required server environment variables

| Variable | Purpose | Where to obtain it | Exposure |
|---|---|---|---|
| `SUPABASE_URL` | Supabase project REST/database endpoint | Supabase Project Settings → API | Server-only; never use as a client `VITE_` variable |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase API access | Supabase Project Settings → API | Highly sensitive; server-only, never expose in browser code |
| `SUPABASE_DB_PASSWORD` | PostgreSQL pooler access when no database URI is available | Supabase Project Settings → Database → Database password | Highly sensitive; server-only |
| `SUPABASE_DB_REGION` | Supabase pooler region; defaults to `ap-northeast-2` for the active Cricket Data Publisher project | Supabase project region | Server-only |
| `CRICKETDATA_API_KEY` | CricketData.org fixture collection | CricketData.org account/API settings | Server-only |
| `GOOGLE_CLIENT_ID` | Google OAuth Web application client ID | Google Cloud Console → APIs & Services → Credentials | Server-only for this backend |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Web application client secret | Google Cloud Console → APIs & Services → Credentials | Highly sensitive; server-only |
| `GOOGLE_ADMIN_EMAIL` | Google account permitted to access the private publisher dashboard | The owner’s Google account email | Server-only; exact lowercase match |
| `BLOGGER_BLOG` | Optional numeric Blogger blog ID | Leave blank initially; the authorized callback discovers it from the configured Blogspot account | Server-only |
| `JWT_SECRET` | Session signing secret used by the application shell | Project secret management | Highly sensitive; server-only |
| `CRON_SECRET` | Bearer secret used by the Vercel Cron publisher endpoint | Generate a random server secret and add it to Vercel | Highly sensitive; server-only |

Do not commit `.env` files, database passwords, service-role keys, OAuth client secrets, or API keys. The application prefers a PostgreSQL URI in `SUPABASE_DB_URL` or `DATABASE_URL`; when those are absent, it constructs the serverless pooler URI from `SUPABASE_URL`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_DB_REGION`. Add the required values in Vercel Project Settings → Environment Variables for Production and Preview as appropriate, then redeploy.

## Vercel routes

The serverless entrypoint is `api/index.ts`, routed by `vercel.json`. The important endpoints are:

- `GET /api/blogger/oauth/start` starts Blogger authorization.
- `GET /api/blogger/oauth/callback` receives the Blogger authorization callback and persists the refresh token.
- `GET /api/google/start` starts dashboard Google Sign-In.
- `GET /api/google/callback` receives dashboard Google Sign-In and creates the application session cookie.
- `POST /api/scheduled/publish-cricket` runs the authenticated scheduled publisher.
- `/api/trpc/*` serves the protected dashboard procedures.

After Vercel assigns the production domain, add this exact redirect URI to the Google Cloud OAuth Web application client:

```text
https://<your-vercel-domain>/api/blogger/oauth/callback
```

For dashboard Google Sign-In, also add this exact production callback URI:

```text
https://cricket-daily-publisher.vercel.app/api/google/callback
```

The dashboard login uses `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_ADMIN_EMAIL`. The Blogger callback remains a separate flow and continues to use its existing Blogger authorization state and refresh-token persistence.

The OAuth consent screen must include the Blogger read/write scope required by the publisher. Keep the app in testing or production according to the Google Cloud account’s verification requirements, and add the owner account as a test user when the app is in testing.

## Supabase

The active project is named **Cricket Data Publisher**. The publisher tables are created by the reviewed Supabase migration. Do not run destructive Drizzle migrations against the existing Supabase project without comparing the generated SQL to the live schema first.

## Scheduling

Vercel Cron is configured in `vercel.json` to call `GET /api/cron/publish-cricket` daily at `18:05 UTC`, which is `00:05 GMT+6`. Add a strong random `CRON_SECRET` to Vercel and configure the cron request with `Authorization: Bearer <CRON_SECRET>` when using an external trigger. The route rejects missing or incorrect credentials. The original Manus Heartbeat callback remains available for deployments that continue using the managed Heartbeat identity.

## Stable Blogger homepage board link

The Blogger theme homepage links to `https://cricket-daily-publisher.vercel.app/api/board`. This endpoint reads `publisher_settings.boardPostUrl` and redirects to the exact current `Daily Cricket Fixture Board` Blogger post. Each publisher run updates or creates the board post and persists its returned Blogger URL in that column, so the theme does not depend on a label archive or a manually changing post URL.

The `publisher_settings.boardPostUrl` column is added by the Supabase migration `add_board_post_url`. Verify that the active Supabase project contains this nullable text column before running the production publisher.
