import crypto from "node:crypto";
import { createBloggerPost, findBloggerPostByMarker, getStoredBloggerSettings, updateBloggerPost } from "./blogger.js";
import { fetchFixtures } from "./cricketdata.js";
import { fetchTheSportsDbFixtures } from "./thesportsdb.js";
import { reconcileFixtures } from "./reconciliation.js";
import { createRun, finishRun, listPublishedUpcomingFixtures, saveBloggerPublication, saveBoardPostUrl, savePreview, upsertNormalizedFixture } from "./db.js";
import type { NormalizedFixture } from "./normalization.js";
import { persistedVerificationFixture } from "./verification-preservation.js";
import { generateMatchPreview } from "./preview.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function contentHash(title: string, content: string, searchDescription: string) {
  return crypto.createHash("sha256").update(`${title}\u0000${content}\u0000${searchDescription}`).digest("hex");
}

const LOOKBACK_MS = 12 * 60 * 60 * 1000;
const LOOKAHEAD_MS = 8 * 24 * 60 * 60 * 1000;
const BOARD_MARKER = 'data-cricket-board="daily"';

function inPublishingWindow(fixture: NormalizedFixture, now = Date.now()) {
  const start = fixture.startTimeUtc.getTime();
  return fixture.status === "live" || (start >= now - LOOKBACK_MS && start <= now + LOOKAHEAD_MS);
}

function publishingDates(now = new Date()) {
  const dates = new Set<string>();
  for (let offset = -1; offset <= 8; offset += 1) {
    const date = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    dates.add(`${values.year}-${values.month}-${values.day}`);
  }
  return Array.from(dates);
}

// The primary CricketData feed is the publishing source of truth. The secondary
// feed remains diagnostic evidence, but it no longer blocks publication.
export function isPublishable(_fixture: NormalizedFixture) {
  return true;
}

export function publishableFixtures(fixtures: NormalizedFixture[]) {
  return fixtures.filter(isPublishable);
}

function postTitle(fixture: NormalizedFixture) {
  return `${fixture.teamOne} vs ${fixture.teamTwo} — ${fixture.localDateGmt6} ${fixture.localTimeGmt6} GMT+6`;
}

function postMarker(fixture: NormalizedFixture) {
  return `data-cricket-fixture="${fixture.externalId}"`;
}

// Blogger's search-result snippet and the theme's Open Graph/description
// tags both read this field, so give every post its own — otherwise Google
// either shows nothing or falls back to a generic, site-wide description
// repeated across every match page.
const META_DESCRIPTION_LIMIT = 155;

function postSearchDescription(fixture: NormalizedFixture, previewText?: string | null) {
  const base = previewText?.trim()
    || `${fixture.teamOne} vs ${fixture.teamTwo} — ${fixture.tournamentName} at ${fixture.venue} on ${fixture.localDateGmt6}, ${fixture.localTimeGmt6} GMT+6.`;
  if (base.length <= META_DESCRIPTION_LIMIT) return base;
  return `${base.slice(0, META_DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function postContent(fixture: NormalizedFixture, previewText?: string | null) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${fixture.teamOne} vs ${fixture.teamTwo}`,
    startDate: fixture.startTimeUtc.toISOString(),
    eventStatus: fixture.status === "cancelled" ? "https://schema.org/EventCancelled" : fixture.status === "completed" ? "https://schema.org/EventCompleted" : "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: fixture.venue },
    competitor: [{ "@type": "SportsTeam", name: fixture.teamOne }, { "@type": "SportsTeam", name: fixture.teamTwo }],
    sport: "Cricket",
  };
  const score = fixture.scoreSummary ? `<p><strong>Match status:</strong> ${fixture.scoreSummary}</p>` : `<p><strong>Match status:</strong> ${fixture.status}</p>`;
  const preview = previewText ? `<h2>Match Preview</h2><p>${escapeHtml(previewText)}</p>` : "";
  const source = fixture.matchUrl ? `<p><a href="${fixture.matchUrl}" rel="nofollow noopener">View match details</a></p>` : "";
  // No <h1> here: the theme already renders the Blogger post title (from
  // postTitle()) as the page's single <h1> on the post's own permalink page.
  // Repeating the matchup as a second in-body <h1> just creates competing
  // headings on the same page, which hurts on-page SEO relevance.
  return `<article class="cricket-match-post" ${postMarker(fixture)}><script type="application/ld+json">${JSON.stringify(structuredData)}</script><p><strong>Tournament:</strong> ${fixture.tournamentName}</p><p><strong>Start time:</strong> ${fixture.localDateGmt6} at ${fixture.localTimeGmt6} GMT+6</p><p><strong>Venue:</strong> ${fixture.venue}</p>${score}${preview}${source}<p>Follow Watch Now Cricket for the latest fixture updates and match status.</p></article>`;
}

export function fixtureMarker(fixture: NormalizedFixture) {
  return `data-cricket-fixture=\"${fixture.externalId}\"`;
}

type BoardRow = { localDateGmt6: string; localTimeGmt6: string; tournamentName: string; teamOne: string; teamTwo: string; postUrl: string | null };

function boardContent(rows: BoardRow[]) {
  const tableRows = rows.map(row => `<tr><td>${row.localDateGmt6}</td><td>${row.localTimeGmt6}</td><td>${row.tournamentName}</td><td>${row.teamOne} vs ${row.teamTwo}</td><td>${row.postUrl ? `<a href=\"${row.postUrl}\">Watch match post</a>` : "Pending"}</td></tr>`).join("");
  return `<section ${BOARD_MARKER}><h2>Daily Cricket Fixture Board</h2><p>Bangladesh time (GMT+6). Tournament-grouped fixtures and their individual match posts.</p><table><thead><tr><th>Date</th><th>Time</th><th>Tournament</th><th>Match</th><th>Details</th></tr></thead><tbody>${tableRows}</tbody></table></section>`;
}

// Minimum gap between two actual Blogger write calls, to stay clear of its
// short-burst rate limit rather than relying only on the 429 retry below.
const BLOGGER_WRITE_GAP_MS = 300;

export async function runPublisher(trigger: "scheduled" | "manual") {
  const runId = await createRun(trigger);
  let fixturesFetched = 0;
  let postsCreated = 0;
  let postsUpdated = 0;
  let postsSkipped = 0;
  let postsFailed = 0;
  let apiStatusCode: number | undefined;
  let bloggerStatusCode: number | undefined;
  const postUrls: string[] = [];
  const fixtureErrors: string[] = [];
  let effectiveVerified = 0;
  let effectiveCandidates = 0;
  let effectiveConflicts = 0;
  try {
    const [source, settings] = await Promise.all([fetchFixtures(), getStoredBloggerSettings()]);
    apiStatusCode = source.statusCode;
    const primaryCandidates = source.fixtures.filter(fixture => inPublishingWindow(fixture));
    const dates = publishingDates();
    const secondaryResults = await Promise.all(dates.map((date) => fetchTheSportsDbFixtures(date)));
    const secondaryFixtures = secondaryResults.flatMap((result) => result.fixtures);
    const coverage = dates.map((date, index) => ({ date, primary: primaryCandidates.filter((fixture) => fixture.localDateGmt6 === date).length, secondary: secondaryResults[index].fixtures.filter((fixture) => fixture.localDateGmt6 === date).length }));
    const reconciled = reconcileFixtures(primaryCandidates, secondaryFixtures);
    fixturesFetched = reconciled.fixtures.length;

    for (const normalized of reconciled.fixtures) {
      // A single fixture failing (a Blogger quota error, a bad response,
      // anything) must never take the whole run down with it — every other
      // fixture still gets its turn, and the board rebuild below still runs
      // no matter how many of these fail.
      try {
        const saved = await upsertNormalizedFixture(normalized);
        const effective = persistedVerificationFixture(normalized, saved);
        if (effective.verificationStatus === "verified") effectiveVerified += 1;
        else if (effective.verificationStatus === "conflict") effectiveConflicts += 1;
        else effectiveCandidates += 1;
        if (!isPublishable(effective)) continue;

        let previewText = saved.previewText ?? null;
        if (!previewText) {
          const generated = await generateMatchPreview(effective);
          if (generated) {
            previewText = generated;
            await savePreview(saved.id, generated);
          }
        }

        const title = postTitle(effective);
        const content = postContent(effective, previewText);
        const searchDescription = postSearchDescription(effective, previewText);
        const labels = ["Cricket", effective.tournamentName, effective.localDateGmt6];
        const newHash = contentHash(title, content, searchDescription);

        // Most scheduled, unstarted fixtures look identical run to run — same
        // teams, venue, time. Re-sending that unchanged content to Blogger
        // every run was the main driver of hitting its quota. Skip the call
        // entirely when nothing has actually changed since the last publish.
        if (saved.bloggerPostId && saved.bloggerContentHash === newHash) {
          postsSkipped += 1;
          continue;
        }

        const reconciledPost = saved.bloggerPostId ? null : await findBloggerPostByMarker(fixtureMarker(effective), settings.googleRefreshToken!);
        if (saved.bloggerPostId || reconciledPost) {
          const postId = saved.bloggerPostId ?? reconciledPost!.id;
          const result = await updateBloggerPost(postId, title, content, labels, settings.googleRefreshToken!, searchDescription);
          bloggerStatusCode = result.statusCode;
          const postUrl = result.post.url ?? reconciledPost?.url ?? null;
          await saveBloggerPublication(saved.id, result.post.id, postUrl, undefined, newHash);
          if (postUrl) postUrls.push(postUrl);
          postsUpdated += 1;
        } else {
          const result = await createBloggerPost(title, content, labels, settings.googleRefreshToken!, searchDescription);
          bloggerStatusCode = result.statusCode;
          await saveBloggerPublication(saved.id, result.post.id, result.post.url ?? null, undefined, newHash);
          if (result.post.url) postUrls.push(result.post.url);
          postsCreated += 1;
        }
        await sleep(BLOGGER_WRITE_GAP_MS);
      } catch (error) {
        postsFailed += 1;
        const message = error instanceof Error ? error.message : String(error);
        fixtureErrors.push(`${normalized.externalId} (${normalized.teamOne} vs ${normalized.teamTwo}): ${message}`);
      }
    }

    // Rebuilt from the database's current state — everything it actually
    // knows has a live Blogger post in the publishing window — rather than
    // only the fixtures this particular run happened to touch. That's what
    // keeps the homepage board accurate even when some fixtures above failed,
    // or when a fixture simply didn't come back from today's fetch.
    let boardRebuildError: string | null = null;
    try {
      const windowStart = new Date(Date.now() - LOOKBACK_MS).toISOString();
      const windowEnd = new Date(Date.now() + LOOKAHEAD_MS).toISOString();
      const published = await listPublishedUpcomingFixtures(windowStart, windowEnd);
      const boardRows: BoardRow[] = published.map(({ fixture, tournament }) => ({
        localDateGmt6: fixture.localDateGmt6,
        localTimeGmt6: fixture.localTimeGmt6,
        tournamentName: tournament.name,
        teamOne: fixture.teamOne,
        teamTwo: fixture.teamTwo,
        postUrl: fixture.bloggerPostUrl,
      }));
      const existingBoard = await findBloggerPostByMarker(BOARD_MARKER, settings.googleRefreshToken!);
      const boardTitle = "Daily Cricket Fixture Board";
      const boardHtml = boardContent(boardRows);
      if (existingBoard) {
        const boardResult = await updateBloggerPost(existingBoard.id, boardTitle, boardHtml, ["Cricket", "homepage-board"], settings.googleRefreshToken!);
        bloggerStatusCode = boardResult.statusCode;
        const boardUrl = boardResult.post.url ?? existingBoard.url;
        if (boardUrl) {
          await saveBoardPostUrl(boardUrl);
          postUrls.push(boardUrl);
        }
      } else {
        const boardResult = await createBloggerPost(boardTitle, boardHtml, ["Cricket", "homepage-board"], settings.googleRefreshToken!);
        bloggerStatusCode = boardResult.statusCode;
        if (boardResult.post.url) {
          await saveBoardPostUrl(boardResult.post.url);
          postUrls.push(boardResult.post.url);
        }
      }
    } catch (error) {
      boardRebuildError = error instanceof Error ? error.message : String(error);
    }

    const coverageMessage = coverage.map((row) => `${row.date}:primary=${row.primary},secondary=${row.secondary}`).join(";");
    const failureMessage = fixtureErrors.length ? `; failures(${fixtureErrors.length}): ${fixtureErrors.slice(0, 5).join(" | ")}` : "";
    const boardMessage = boardRebuildError ? `; board rebuild FAILED: ${boardRebuildError}` : "; board rebuilt from database";
    const verificationMessage = `verification: verified=${effectiveVerified}, candidates=${effectiveCandidates}, conflicts=${effectiveConflicts}, cricketdataPages=${source.pagesFetched}; coverage: ${coverageMessage}; posts: created=${postsCreated}, updated=${postsUpdated}, skipped(unchanged)=${postsSkipped}, failed=${postsFailed}${boardMessage}${failureMessage}`;
    const finalStatus = postsFailed > 0 || boardRebuildError || effectiveCandidates > 0 || effectiveConflicts > 0 ? "partial" : "success";
    await finishRun(runId, { status: finalStatus, fixturesFetched, postsCreated, postsUpdated, apiStatusCode, bloggerStatusCode, postUrls: JSON.stringify(postUrls), errorMessage: verificationMessage });
    return { runId, status: finalStatus as "success" | "partial", fixturesFetched, postsCreated, postsUpdated, postsSkipped, postsFailed, verification: { ...reconciled, verified: effectiveVerified, candidates: effectiveCandidates, conflicts: effectiveConflicts } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(runId, { status: fixturesFetched > 0 ? "partial" : "failed", fixturesFetched, postsCreated, postsUpdated, apiStatusCode, bloggerStatusCode, postUrls: JSON.stringify(postUrls), errorMessage: message });
    throw error;
  }
}
