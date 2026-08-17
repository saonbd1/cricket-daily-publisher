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
- [ ] Synchronize the Blogger homepage event table with generated post links.
- [x] Add a published-post count metric to the dashboard.
- [x] Extend run history with API/Blogger response codes and created or updated post URLs.
- [ ] Add Vitest coverage for duplicate prevention, status mapping, and create/update publishing behavior.
