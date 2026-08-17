# Google Cloud OAuth Setup Notes

- Google Cloud project currently selected: `my-project-1786947342935` (display name: My Project).
- Google Cloud Console: https://console.cloud.google.com/
- Blogger API service page used: https://console.cloud.google.com/apis/library/blogger.googleapis.com?project=my-project-1786947342935
- OAuth branding configured with app name: `Cricket Daily Publisher`.
- Developer contact email configured: `classicbd616@gmail.com`.
- OAuth audience is external and already in production; no test user was required.
- OAuth client creation form: https://console.cloud.google.com/auth/clients/create?project=my-project-1786947342935
- Intended client type: Web application.
- Intended client name: `Cricket Daily Publisher Web`.
- The first create attempt appeared to remain in a spinner and the client list showed no client, so the form was reopened. Current form is loaded with Web application selected, but the default client name is currently `Web client 1`; it must be changed back to `Cricket Daily Publisher Web` before creation.
- OAuth client secret must not be copied into chat or logged. It should be entered later through the project secret-management flow.
- The hosted Blogger callback path still needs to be implemented in the project before finalizing the production redirect URI. Planned callback prefix must be `/api/` for the app route, while scheduled endpoints must use `/api/scheduled/` per the scheduling guidance.

Google Cloud verification on Aug 17, 2026: the OAuth client list now contains `Cricket Daily Publisher` with creation date Aug 17, 2026 and type `Web application`. The client ID is displayed only partially in the console as `152762050604-r1ou...`; no client secret was opened, copied, or stored.

External API verification, Aug 17, 2026:
- CricketData official Python samples document `GET https://api.cricapi.com/v1/matches?apikey=<APIKEY>&offset=0` for the Matches List API. Source: https://cricketdata.org/python-code-samples/
- The same official page documents `GET https://api.cricapi.com/v1/match_scorecard?apikey=<APIKEY>&offset=0&id=<id>` for scorecards.
- Google’s official Blogger API Getting Started page lists REST resources including `https://www.googleapis.com/blogger/v3/users/self/blogs`, `https://www.googleapis.com/blogger/v3/blogs/blogId`, and `https://www.googleapis.com/blogger/v3/blogs/blogId/posts`. Source: https://developers.google.com/blogger/docs/3.0/getting_started
- The CricketData documentation page `https://cricketdata.org/how-to-use-cricket-data-api.aspx` returned a provider-side ASP.NET session error during retrieval, so endpoint behavior will be handled defensively.

External deployment notes (2026-08-17):
- Vercel account/team dashboard: https://vercel.com/saons-projects-c9a3d307
- GitHub repository imported into Vercel flow: https://github.com/saonbd1/cricket-daily-publisher
- Vercel deployment was submitted and showed Loading... Deploying. No environment-variable values were entered at deployment time.

- Vercel verification after redeploy attempt: project URL `https://vercel.com/saons-projects-c9a3d307/cricket-daily-publisher` still shows **No Production Deployment** and says production updates require a push to the main branch. The connected repository is `https://github.com/saonbd1/cricket-daily-publisher`; no production domain is serving traffic yet.

- Vercel deployment verification (2026-08-17): Git settings now show `saonbd1/cricket-daily-publisher` connected. Overview and Deployments still show `No Production Deployment` and state that production updates require a push to the `main` branch. The project has no preview deployments or production traffic yet; a new main-branch commit is required to trigger deployment.
