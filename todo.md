# Project TODO

- [x] Add CricketData.org API integration with secure environment secret handling
- [x] Add Blogger OAuth credential handling with secure environment secrets
- [x] Define database tables for fixtures, tournaments, Blogger posts, and run logs
- [x] Normalize all fixture timestamps to GMT+6 for storage and display
- [x] Implement daily fixture collection grouped by tournament
- [x] Implement duplicate prevention using fixture identity and today’s Blogger posts
- [x] Implement automatic Blogger post creation with SportsEvent schema markup
- [x] Implement event-table data with direct links to published Blogger posts
- [x] Implement Scheduled, Live, and Completed status transitions
- [x] Implement Blogger post patching when match status or score changes
- [x] Implement daily cron/Heartbeat execution
- [x] Implement admin dashboard with collection status, published count, and last-run timestamp
- [x] Implement manual collection and publishing trigger
- [x] Implement run-log viewer with success/failure, API response codes, and created URLs
- [x] Add responsive modern dashboard styling
- [x] Add Vitest coverage for normalization, duplicate prevention, status transitions, and publishing logic
- [ ] Validate the complete workflow and save a final checkpoint

- [x] Add Blogger post lookup and reconciliation when local fixture state is absent.
- [x] Embed SportsEvent JSON-LD schema markup in generated match posts.
- [x] Connect the existing hardcoded Blogger theme homepage table to the generated Daily Cricket Fixture Board post.
- [x] Add a published-post count metric to the dashboard.
- [x] Extend run history with API/Blogger response codes and created or updated post URLs.
- [x] Add Vitest coverage for duplicate prevention, status mapping, and create/update publishing behavior.

- [x] Assess Supabase connection mode and whether the existing MySQL/Drizzle schema can be reused without migration risk.
- [x] Add Vercel-compatible backend entrypoints and deployment configuration.
- [x] Add Supabase/Vercel environment-secret documentation and validation tests.
- [x] Replace or supplement Manus Heartbeat with an external cron trigger compatible with Vercel.
- [ ] Update Blogger OAuth redirect URI for the chosen Vercel domain.
- [x] Run tests and save an external-hosting checkpoint.
- [ ] Fix Vercel production root serving bundled source instead of the application response, then verify the live API and dashboard.
- [x] Link the Blogger homepage event dashboard to the automated homepage-board post label.
- [ ] Complete an end-to-end production publisher run and confirm daily scheduling.
- [x] Add a deterministic direct-link mechanism from the Blogger homepage dashboard to the actual Daily Cricket Fixture Board post URL, not only the homepage-board label archive.
- [x] Persist the board post URL or slug in publisher state and document how the theme uses that exact post link.
