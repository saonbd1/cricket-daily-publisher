# Worldwide SEO Keyword Research for the Cricket Publisher Project

## Scope

Target market: worldwide. Data source: public search results and official documentation only. Search volume, keyword difficulty, CPC, and traffic claims are not verified platform metrics and must be treated as directional.

## Evidence boundary

The project evidence includes a clean Blogger cricket theme; GMT+6 fixture normalization; automated CricketData collection; bounded pagination; TheSportsDB secondary discovery; candidate, verified, and conflict states; source evidence persistence; a verified-only Blogger publish gate; Vercel Cron; Supabase persistence; a dashboard review queue; a successful authenticated production cron invocation; and responsive QA around 390px.

The evidence does not support claims of organic traffic growth, rankings, search volume, revenue, or complete global fixture coverage. Public-source corroboration should be described as a project workflow, not as a guaranteed universal data solution.

## Initial topic clusters

1. Automated cricket fixtures and daily schedule publishing.
2. Cricket API integration, pagination, and multi-source reconciliation.
3. Blogger cricket theme design, responsive tables, and SEO markup.
4. Vercel Cron and Supabase automation for scheduled sports data.
5. Cricket data verification, duplicate prevention, and review queues.

## Initial public phrasing signals

Public schedule pages repeatedly use phrases such as cricket fixtures, cricket schedule, upcoming cricket matches, fixtures and results, match schedules, live scores, and tournament schedules. Official API documentation uses terms including fixture list, match summary API, season filtering, date filtering, and fixture updates. The project-specific long-tail opportunities should combine these established phrases with the verified implementation problems: GMT+6 time conversion, Blogger publishing, source verification, candidate fixtures, duplicate-safe updates, Vercel Cron, Supabase, and responsive fixture tables.

Further terms require public SERP expansion and should remain directional until validated with first-party search data.

## Sources reviewed

- ESPNcricinfo fixture schedule: https://www.cricinfo.com/live-cricket-match-schedule-fixtures
- ICC fixtures and results: https://www.icc-cricket.com/fixtures-results
- ECB Play-Cricket Match Summary API: https://play-cricket.ecb.co.uk/hc/en-us/articles/360000130385-Match-Summary-API
- Bangladesh Cricket Board fixtures: https://www.tigercricket.com.bd/fixtures
- CricketData documentation: https://cricketdata.org/how-to-use-cricket-data-api.aspx
- Highlightly Cricket API documentation: https://highlightly.net/cricket-api/documentation/
- TheSportsDB API guide: https://www.thesportsdb.com/docs_api_guide

## Prioritized keyword opportunities

The priority labels below are directional. They combine public phrasing visibility, relevance to the project, specificity, and the likelihood that the project can demonstrate first-hand experience. They are not search-volume estimates.

| Priority | Potential keyword | Cluster | Intent | Evidence fit | Recommended article angle |
|---|---|---|---|---|---|
| High | cricket fixtures API | API integration | Commercial/informational | Strong | How to build a cricket fixtures API workflow for a schedule website |
| High | cricket schedule API | API integration | Commercial/informational | Strong | Cricket schedule API integration: date filtering, pagination, and normalization |
| High | daily cricket fixtures automation | Automation | Informational/solution | Strong | How we automated daily cricket fixture publishing |
| High | automated cricket schedule website | Automation | Solution seeking | Strong | Building an automated cricket schedule website with Blogger and Vercel |
| High | cricket fixtures website | Product/informational | Navigational/solution | Strong | What a clean cricket fixtures website needs: tables, time zones, and links |
| High | upcoming cricket matches worldwide | Schedule | Informational | Partial | How to build a worldwide upcoming-cricket-matches board without missing events |
| High | cricket fixtures today | Schedule | Informational | Partial | Designing a reliable “cricket fixtures today” page with source timestamps |
| High | cricket schedule GMT+6 | Timezone | Informational | Strong | Convert cricket fixture times to Bangladesh time (GMT+6) safely |
| High | cricket match schedule Bangladesh time | Timezone | Informational | Strong | Cricket match schedule in Bangladesh time: implementation guide |
| High | cricket API pagination | API engineering | Informational/technical | Strong | Fixing incomplete cricket schedules caused by a limited API page |
| High | cricket API date filtering | API engineering | Informational/technical | Strong | Date-aware cricket fixture filtering across UTC and GMT+6 |
| High | verify cricket fixtures from multiple sources | Data quality | Informational/technical | Strong | Multi-source cricket fixture verification with candidate and conflict states |
| Medium | cricket API duplicate prevention | Data quality | Technical | Strong | Preventing duplicate cricket posts during scheduled syncs |
| Medium | cricket fixture reconciliation | Data quality | Technical | Strong | Reconcile CricketData and secondary cricket sources deterministically |
| Medium | cricket data verification workflow | Data quality | Technical | Strong | A verified-only publication gate for cricket data |
| Medium | cricket schedule data pipeline | Automation | Technical | Strong | Design a cricket schedule data pipeline with Supabase persistence |
| Medium | cricket fixtures Supabase | Backend | Technical | Strong | Store and review cricket fixtures with Supabase |
| Medium | Vercel cron cricket API | Scheduling | Technical | Strong | Schedule cricket API collection with Vercel Cron |
| Medium | Vercel Cron scheduled API request | Scheduling | Technical | Strong | Secure scheduled API requests with a bearer secret |
| Medium | Supabase cricket data sync | Backend | Technical | Strong | Sync cricket fixtures into Supabase with run diagnostics |
| Medium | Blogger cricket theme | Blogger design | Informational/solution | Strong | How we built a clean premium Blogger theme for cricket fixtures |
| Medium | Blogger responsive cricket table | Blogger design | Informational | Strong | Build a mobile-responsive cricket fixture table in Blogger |
| Medium | Blogger cricket schedule template | Blogger design | Solution seeking | Strong | A clean Blogger schedule template without inherited credits or trackers |
| Medium | Blogger sports schema markup | SEO | Technical/informational | Strong | Add Article and WebSite structured data to a Blogger sports site |
| Medium | cricket fixtures SEO | SEO | Informational | Strong | SEO structure for a cricket fixtures and match schedule website |
| Medium | mobile friendly cricket fixture table | UX | Informational | Strong | Mobile QA for cricket tables at approximately 390px |
| Medium | cricket schedule table design | UX | Informational/design | Strong | Design tournament-grouped fixture tables for readability |
| Low | TheSportsDB cricket fixtures | API integration | Navigational/technical | Partial | Use TheSportsDB as a secondary cricket schedule discovery source |
| Low | CricketData API tutorial | API integration | Informational | Strong | A practical CricketData API tutorial based on a production publisher |
| Low | cricket Blogger automation with Vercel | Automation | Technical/solution | Strong | Connect Blogger publishing, Vercel Cron, and Supabase |
| Low | cricket fixture review queue | Data quality | Technical | Strong | Build a dashboard review queue for unverified cricket fixtures |
| Low | cricket source evidence database | Data quality | Technical | Strong | Persist source evidence and audit history for sports fixtures |

## Recommended first six articles

1. **How We Built an Automated Cricket Fixtures Website with Blogger, Vercel, and Supabase** — the strongest flagship case study because it unifies the project’s major components.
2. **Cricket Schedule API Integration: Pagination, Date Filtering, and GMT+6 Conversion** — targets technical searchers with a specific implementation problem.
3. **How to Verify Cricket Fixtures from Multiple Sources Before Publishing** — differentiates the site through data-quality experience.
4. **Build a Mobile-Responsive Cricket Fixture Table in Blogger** — addresses a practical Blogger design problem and can include real QA evidence.
5. **How to Prevent Duplicate Cricket Posts During Automated API Syncs** — targets a common production failure mode and uses the verified preservation fix as proof.
6. **How to Schedule a Cricket API Sync with Vercel Cron and Supabase** — documents the successful authenticated production run and secret configuration lesson.

## Suggested content architecture

Use one flagship implementation article as the hub. Link from it to API integration, time-zone normalization, source verification, Blogger table design, duplicate prevention, and Vercel Cron troubleshooting articles. Keep daily fixture pages as utility pages, while the experience-based articles explain the durable implementation decisions. Use specific dates and run results only in case-study sections, not as evergreen headline promises.

## Search and citation notes

The schedule vocabulary is supported by [ESPNcricinfo’s fixture schedule](https://www.cricinfo.com/live-cricket-match-schedule-fixtures) and the [ICC Fixtures & Results page](https://www.icc-cricket.com/fixtures-results). API and fixture-list terminology is supported by the [ECB Play-Cricket Match Summary API documentation](https://play-cricket.ecb.co.uk/hc/en-us/articles/360000130385-Match-Summary-API) and [Cricket API Schedule API documentation](https://www.cricketapi.com/docs/Core-API/Schedule-API/). Vercel documents cron jobs as HTTP GET requests to a production path and specifies UTC scheduling in its [Cron Jobs documentation](https://vercel.com/docs/cron-jobs). Google’s [Article structured-data guidance](https://developers.google.com/search/docs/appearance/structured-data/article) supports the structured-data implementation topic but does not guarantee rich results or rankings.
