import { createBloggerPost, findBloggerPostByMarker, getStoredBloggerSettings, updateBloggerPost } from "./blogger.js";
import { fetchFixtures } from "./cricketdata.js";
import { fetchTheSportsDbFixtures } from "./thesportsdb.js";
import { reconcileFixtures } from "./reconciliation.js";
import { createRun, finishRun, saveBloggerPublication, saveBoardPostUrl, upsertNormalizedFixture } from "./db.js";
import type { NormalizedFixture } from "./normalization.js";
import { persistedVerificationFixture } from "./verification-preservation.js";

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

export function isPublishable(fixture: NormalizedFixture) {
  return fixture.verificationStatus === "verified";
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

export function postContent(fixture: NormalizedFixture) {
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
  const source = fixture.matchUrl ? `<p><a href="${fixture.matchUrl}" rel="nofollow noopener">View match details</a></p>` : "";
  return `<article class="cricket-match-post" ${postMarker(fixture)}><script type="application/ld+json">${JSON.stringify(structuredData)}</script><h1>${fixture.teamOne} vs ${fixture.teamTwo}</h1><p><strong>Tournament:</strong> ${fixture.tournamentName}</p><p><strong>Start time:</strong> ${fixture.localDateGmt6} at ${fixture.localTimeGmt6} GMT+6</p><p><strong>Venue:</strong> ${fixture.venue}</p>${score}${source}<p>Follow Watch Now Cricket for the latest fixture updates and match status.</p></article>`;
}

export function fixtureMarker(fixture: NormalizedFixture) {
  return `data-cricket-fixture=\"${fixture.externalId}\"`;
}

function boardContent(rows: Array<{ fixture: NormalizedFixture; postUrl: string | null }>) {
  const tableRows = rows.map(row => `<tr><td>${row.fixture.localDateGmt6}</td><td>${row.fixture.localTimeGmt6}</td><td>${row.fixture.tournamentName}</td><td>${row.fixture.teamOne} vs ${row.fixture.teamTwo}</td><td>${row.postUrl ? `<a href=\"${row.postUrl}\">Watch match post</a>` : "Pending"}</td></tr>`).join("");
  return `<section ${BOARD_MARKER}><h1>Daily Cricket Fixture Board</h1><p>Bangladesh time (GMT+6). Tournament-grouped fixtures and their individual match posts.</p><table><thead><tr><th>Date</th><th>Time</th><th>Tournament</th><th>Match</th><th>Details</th></tr></thead><tbody>${tableRows}</tbody></table></section>`;
}

export async function runPublisher(trigger: "scheduled" | "manual") {
  const runId = await createRun(trigger);
  let fixturesFetched = 0;
  let postsCreated = 0;
  let postsUpdated = 0;
  let apiStatusCode: number | undefined;
  let bloggerStatusCode: number | undefined;
  const postUrls: string[] = [];
  const boardRows: Array<{ fixture: NormalizedFixture; postUrl: string | null }> = [];
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
      const saved = await upsertNormalizedFixture(normalized);
      const effective = persistedVerificationFixture(normalized, saved);
      if (effective.verificationStatus === "verified") effectiveVerified += 1;
      else if (effective.verificationStatus === "conflict") effectiveConflicts += 1;
      else effectiveCandidates += 1;
      if (!isPublishable(effective)) continue;
      const title = postTitle(effective);
      const content = postContent(effective);
      const labels = ["Cricket", effective.tournamentName, effective.localDateGmt6];
      const reconciledPost = saved.bloggerPostId ? null : await findBloggerPostByMarker(fixtureMarker(effective), settings.googleRefreshToken!);
      if (saved.bloggerPostId || reconciledPost) {
        const postId = saved.bloggerPostId ?? reconciledPost!.id;
        const result = await updateBloggerPost(postId, title, content, labels, settings.googleRefreshToken!);
        bloggerStatusCode = result.statusCode;
        if (reconciledPost && !saved.bloggerPostId) await saveBloggerPublication(saved.id, result.post.id, result.post.url ?? reconciledPost.url ?? null);
        if (result.post.url) postUrls.push(result.post.url);
        boardRows.push({ fixture: effective, postUrl: result.post.url ?? reconciledPost?.url ?? null });
        postsUpdated += 1;
      } else {
        const result = await createBloggerPost(title, content, labels, settings.googleRefreshToken!);
        bloggerStatusCode = result.statusCode;
        await saveBloggerPublication(saved.id, result.post.id, result.post.url ?? null);
        if (result.post.url) postUrls.push(result.post.url);
        boardRows.push({ fixture: effective, postUrl: result.post.url ?? null });
        postsCreated += 1;
      }
    }
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
    const coverageMessage = coverage.map((row) => `${row.date}:primary=${row.primary},secondary=${row.secondary}`).join(";");
    const verificationMessage = `verification: verified=${effectiveVerified}, candidates=${effectiveCandidates}, conflicts=${effectiveConflicts}, cricketdataPages=${source.pagesFetched}; coverage: ${coverageMessage}`;
    const finalStatus = effectiveCandidates > 0 || effectiveConflicts > 0 ? "partial" : "success";
    await finishRun(runId, { status: finalStatus, fixturesFetched, postsCreated, postsUpdated, apiStatusCode, bloggerStatusCode, postUrls: JSON.stringify(postUrls), errorMessage: verificationMessage });
    return { runId, status: finalStatus as "success" | "partial", fixturesFetched, postsCreated, postsUpdated, verification: { ...reconciled, verified: effectiveVerified, candidates: effectiveCandidates, conflicts: effectiveConflicts } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(runId, { status: fixturesFetched > 0 ? "partial" : "failed", fixturesFetched, postsCreated, postsUpdated, apiStatusCode, bloggerStatusCode, postUrls: JSON.stringify(postUrls), errorMessage: message });
    throw error;
  }
}
