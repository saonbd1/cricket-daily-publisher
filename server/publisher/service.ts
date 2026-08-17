import { createBloggerPost, findBloggerPostByMarker, getStoredBloggerSettings, updateBloggerPost } from "./blogger";
import { fetchFixtures } from "./cricketdata";
import { createRun, finishRun, saveBloggerPublication, upsertNormalizedFixture } from "./db";
import type { NormalizedFixture } from "./normalization";

const LOOKBACK_MS = 12 * 60 * 60 * 1000;
const LOOKAHEAD_MS = 8 * 24 * 60 * 60 * 1000;
const BOARD_MARKER = 'data-cricket-board="daily"';

function inPublishingWindow(fixture: NormalizedFixture, now = Date.now()) {
  const start = fixture.startTimeUtc.getTime();
  return fixture.status === "live" || (start >= now - LOOKBACK_MS && start <= now + LOOKAHEAD_MS);
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
  try {
    const [source, settings] = await Promise.all([fetchFixtures(), getStoredBloggerSettings()]);
    apiStatusCode = source.statusCode;
    const candidates = source.fixtures.filter(fixture => inPublishingWindow(fixture));
    fixturesFetched = candidates.length;
    for (const normalized of candidates) {
      const saved = await upsertNormalizedFixture(normalized);
      const title = postTitle(normalized);
      const content = postContent(normalized);
      const labels = ["Cricket", normalized.tournamentName, normalized.localDateGmt6];
      const reconciledPost = saved.bloggerPostId ? null : await findBloggerPostByMarker(fixtureMarker(normalized), settings.googleRefreshToken!);
      if (saved.bloggerPostId || reconciledPost) {
        const postId = saved.bloggerPostId ?? reconciledPost!.id;
        const result = await updateBloggerPost(postId, title, content, labels, settings.googleRefreshToken!);
        bloggerStatusCode = result.statusCode;
        if (reconciledPost && !saved.bloggerPostId) await saveBloggerPublication(saved.id, result.post.id, result.post.url ?? reconciledPost.url ?? null);
        if (result.post.url) postUrls.push(result.post.url);
        boardRows.push({ fixture: normalized, postUrl: result.post.url ?? reconciledPost?.url ?? null });
        postsUpdated += 1;
      } else {
        const result = await createBloggerPost(title, content, labels, settings.googleRefreshToken!);
        bloggerStatusCode = result.statusCode;
        await saveBloggerPublication(saved.id, result.post.id, result.post.url ?? null);
        if (result.post.url) postUrls.push(result.post.url);
        boardRows.push({ fixture: normalized, postUrl: result.post.url ?? null });
        postsCreated += 1;
      }
    }
    const existingBoard = await findBloggerPostByMarker(BOARD_MARKER, settings.googleRefreshToken!);
    const boardTitle = "Daily Cricket Fixture Board";
    const boardHtml = boardContent(boardRows);
    if (existingBoard) {
      const boardResult = await updateBloggerPost(existingBoard.id, boardTitle, boardHtml, ["Cricket", "homepage-board"], settings.googleRefreshToken!);
      bloggerStatusCode = boardResult.statusCode;
    } else {
      const boardResult = await createBloggerPost(boardTitle, boardHtml, ["Cricket", "homepage-board"], settings.googleRefreshToken!);
      bloggerStatusCode = boardResult.statusCode;
      if (boardResult.post.url) postUrls.push(boardResult.post.url);
    }
    await finishRun(runId, { status: "success", fixturesFetched, postsCreated, postsUpdated, apiStatusCode, bloggerStatusCode, postUrls: JSON.stringify(postUrls) });
    return { runId, status: "success" as const, fixturesFetched, postsCreated, postsUpdated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(runId, { status: fixturesFetched > 0 ? "partial" : "failed", fixturesFetched, postsCreated, postsUpdated, apiStatusCode, bloggerStatusCode, postUrls: JSON.stringify(postUrls), errorMessage: message });
    throw error;
  }
}
