# Production investigation — 2026-08-18

## Live homepage
Source: https://watchnowcricket.blogspot.com/

The live homepage rendered the custom shell, date, navigation, Fixture Board button, Hall of Fame, and footer, but no Blog post body or fixture table. The visible date was `Tuesday, August 18, 2026`. The ticker rendered escaped backslash text in the previously uploaded version.

## Fixture Board redirect
Source: https://cricket-daily-publisher.vercel.app/api/board

The redirect resolved to `https://watchnowcricket.blogspot.com/2026/08/daily-cricket-fixture-board_0385420378.html`, but the page rendered the same shell without the generated post body or table. This indicates the active Blogger theme's Blog widget rendering contract is incomplete, not that the publisher failed to create the post.

## Dashboard
Source: https://cricket-daily-publisher.vercel.app/

Latest visible run: `manual`, August 17, 2026 11:47:50 PM; 2 fixtures, 0 created, 2 updated; API 200 and Blogger 200. Two fixture posts and a Daily Cricket Fixture Board URL were persisted. No scheduled run was visible in the dashboard history.

## Cron endpoint
Source: https://cricket-daily-publisher.vercel.app/api/cron/publish-cricket

Unauthenticated GET returned `{"error":"Cron authentication required"}`. This confirms the deployed route is reachable and protected. `vercel.json` configures `/api/cron/publish-cricket` at `5 18 * * *` (18:05 UTC / 00:05 Bangladesh time), but an actual scheduled execution was not independently confirmed.

## Root cause and local fix
The clean theme's Blog widget had a `main` includable that directly emitted post markup, but lacked Blogger's reusable `post` includable and `<b:include data='post' name='post'/>` contract. The corrected theme now includes both. The corrected theme also uses literal bullet characters in the ticker and has a rendered Fixture Board link. Static XML/security validation and 37 Vitest tests pass.

## Second clean-theme upload verification

Source URLs:
- Homepage: https://watchnowcricket.blogspot.com/
- Fixture Board redirect: https://cricket-daily-publisher.vercel.app/api/board
- Direct board post observed: https://watchnowcricket.blogspot.com/2026/08/daily-cricket-fixture-board_0385420378.html

Observed after the second manual upload:
- The ticker renders as `LIVE CRICKET • SCORE • STREAM`.
- The GMT+6 date renders as `Tuesday, August 18, 2026`.
- The clean custom shell, navigation, Hall of Fame, and Fixture Board CTA render.
- The footer visibly includes Home, Powered by Blogger, and Report Abuse.
- The fixture table/post body is still absent on both the homepage and direct board post.
- Browser DOM inspection showed `<main id="main" class="main no-items section">` and no post-card/post-body nodes.

Latest local repair prepared after this observation:
- Added `b:defaultmarkup type='Blog'` with `super.main` and `postCommentsAndAd`.
- Added Blog widget settings.
- Changed the widget main includable to `id='main'` without `var='top'`.
- Added a dynamic `data:blog.reportAbuseUrl` footer link.
- XML validator passes and all 38 Vitest tests pass.
- The revised XML still requires one more manual Blogger upload and live verification.

## Final-upload verification

After the final manual upload, both the homepage and the direct Daily Cricket Fixture Board URL still render the clean shell, date, ticker, navigation, Hall of Fame, and footer links, but neither renders any Blogger post body or fixture table. The live DOM remains a `main no-items` Blog section. This confirms the remaining issue is the Blogger Blog widget data pipeline or template contract, not the publisher’s post creation or the `/api/board` redirect. The local template includes the latest default-markup, widget-settings, `super.main`, and `postCommentsAndAd` repair and passes 38 Vitest tests, but Blogger has not yet accepted that pipeline in production.

## Head-fix upload verification

After the upload described as `uploaded head fixed`, the homepage and direct board URL still show the clean shell with the date, ticker, navigation, Hall of Fame, and footer links, but no fixture post body or table rows. The direct board URL remains https://watchnowcricket.blogspot.com/2026/08/daily-cricket-fixture-board_0385420378.html via https://cricket-daily-publisher.vercel.app/api/board. The rendered content still has no post title or post body beneath the shell, so the `b:defaultmarkups` placement fix alone did not make Blogger supply post data.

## Page-body upload verification

At 2026-08-18 13:25 UTC, after the `page_body` upload, the homepage and direct Fixture Board post still rendered the clean shell, GMT+6 date, bullet ticker, navigation, Hall of Fame, Powered by Blogger, and Report Abuse. Neither route rendered the generated post body or fixture table. The `page_body` placement repair alone did not restore Blogger post data delivery; further Blog-widget contract diagnosis is required.

## Public feed verification

The public feed https://watchnowcricket.blogspot.com/feeds/posts/default?alt=json&max-results=5 contains the Daily Cricket Fixture Board and match posts with published HTML bodies. The board entry includes a `data-cricket-board="daily"` section and a complete table with dates, GMT+6 times, tournament, match, and direct match-post links. This confirms the publisher created public posts correctly; the remaining absence on homepage/direct post pages is entirely in the active Blogger theme Blog-widget rendering path.

## Same-origin Blogger feed fallback

The clean theme now includes a deliberate fallback for the case where Blogger’s native Blog widget compiles with `no-items` even though the public feed contains published posts. On DOM ready, it requests only the current blog’s relative endpoint `/feeds/posts/default?alt=json&max-results=20` with `credentials: 'same-origin'`. On the homepage it renders the returned published entries; on a direct post path it filters to the matching entry URL. Before inserting post content, it removes scripts, frames, objects, embeds, forms, style/link/meta nodes, inline event-handler attributes, and `javascript:` hrefs. Titles, URLs, and dates are HTML-escaped. The native Blogger widget remains the fallback if the feed request fails.

This code is intentionally limited to the site-local feed and contains no third-party fetch, redirect, tracker, or external executable asset. It requires one final manual Blogger upload and live verification on both the homepage and the Daily Cricket Fixture Board route.

## Final feed-fallback live verification

After the final feed-fallback upload, the homepage rendered the live date `Tuesday, August 18, 2026`, the clean `LIVE CRICKET • SCORE • STREAM` ticker, navigation, Hall of Fame section, and the published Daily Cricket Fixture Board table with two fixtures. The direct `/api/board` route resolved to the board post and rendered the same table. The direct post visibly preserved `Powered by Blogger` and `Report Abuse`; no inherited `Theme images by rami_ba` credit appeared. The public feed content and the live rendered table now agree.

At verification time, the scheduled Vercel window had not yet arrived; the next configured run remains 18:05 UTC / 00:05 Bangladesh time.

## Desktop palette and contrast verification

The final-upload desktop browser capture visibly shows the intended midnight-blue background and surfaces, electric-cyan accent treatment, soft-violet navigation/hero detailing, and white/light-blue text with readable contrast. The fixture table uses a darker blue header and alternating dark rows with legible white text and cyan links. The same capture shows the clean ticker, date, Hall of Fame cards, Powered by Blogger, and Report Abuse links together.
