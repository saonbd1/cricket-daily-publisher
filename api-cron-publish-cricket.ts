// api/cron/publish-cricket.ts
// Browserbase-powered daily cricket news publisher
// Runs via Vercel Cron at 18:05 UTC (00:05 GMT+6)
// Publishes max 2-3 simple-English news articles per day to Blogger

import { Stagehand } from "@browserbasehq/stagehand";
import { timingSafeEqual } from "node:crypto";

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BLOGGER_BLOG_ID = process.env.BLOGGER_BLOG_ID;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BLOGGER_REFRESH_TOKEN = process.env.BLOGGER_REFRESH_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_ARTICLES_PER_DAY = 3;

function log(level: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${level}] ${msg}`);
}

async function supabaseRest(table: string, options: any = {}) {
  const baseUrl = SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase not configured");
  const url = new URL(`${baseUrl}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer ?? "return=representation",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase REST ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined;
async function refreshOauthToken() {
  log("info", "Step 0: Refreshing Google OAuth access token");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: BLOGGER_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth refresh failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

async function bloggerCreateDraft(accessToken: string, title: string, htmlContent: string, labels: string[]) {
  log("info", `Step A: Creating Blogger draft "${title}"`);
  const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_BLOG_ID}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: "blogger#post",
      blog: { id: BLOGGER_BLOG_ID },
      title,
      content: htmlContent,
      labels: labels.length ? labels : ["cricket", "daily", "match-preview"],
      status: "DRAFT",
    }),
  });
async function browserbaseFetch(url: string, format: "markdown" | "html" = "markdown") {
  log("info", `Browserbase Fetch: ${url}`);
  const res = await fetch(url, {
    headers: { "X-Browserbase-Api-Key": BROWSERBASE_API_KEY! },
  });
  if (!res.ok) throw new Error(`Browserbase fetch failed for ${url}: ${res.status}`);
  return format === "markdown" ? res.text() : res.text();
}

function rewriteSimpleEnglish(rawText: string, title: string): { title: string; body: string } {
  const sentences = rawText
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const rewritten = sentences
    .map(s => {
      let out = s
        .replace(/\bwon't\b/gi, "will not")
        .replace(/\bcan't\b/gi, "cannot")
        .replace(/\bdon't\b/gi, "do not")
        .replace(/\bit's\b/gi, "it is")
        .replace(/\bthey're\b/gi, "they are")
        .replace(/\bhaven't\b/gi, "have not")
        .replace(/\bhasn't\b/gi, "has not")
        .replace(/\bwouldn't\b/gi, "would not")
        .replace(/\bshouldn't\b/gi, "should not")
        .replace(/\bdoesn't\b/gi, "does not");

      out = out
        .replace(/\bpromises to\b/gi, "will")
        .replace(/\bmay\b/gi, "")
        .replace(/\bmight\b/gi, "")
        .replace(/\bcould\b/gi, "can")
        .replace(/\bseems to\b/gi, "")
        .replace(/\bappears to\b/gi, "");

export default async function handler(req: any, res: any) {
  if (CRON_SECRET) {
    const auth = req.headers.authorization || "";
    const expected = `Bearer ${CRON_SECRET}`;
    if (!timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!BROWSERBASE_API_KEY || !BLOGGER_BLOG_ID || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !BLOGGER_REFRESH_TOKEN) {
    log("error", "Missing required environment variables");
    return res.status(500).json({ error: "Missing env vars" });
  }

  log("info", "=== Browserbase Daily Publisher Started ===");

  try {
    log("info", "Step 1: Fetching today's fixtures from watchnowcricket.blogspot.com");
    const fixturesHtml = await browserbaseFetch("https://watchnowcricket.blogspot.com", "html");

    const today = new Date().toISOString().slice(0, 10);
    const fixtureMatches: Array<{ teamOne: string; teamTwo: string; tournament: string; time: string }> = [];

    const rowRegex = /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+([^<]+?)\s+([^<]+?)\s+vs\s+([^<]+?)/gi;
    let match;
    while ((match = rowRegex.exec(fixturesHtml)) !== null) {
      if (match[1] === today) {
        fixtureMatches.push({
          teamOne: match[4].trim(),
          teamTwo: match[5].trim(),
          tournament: match[3].trim(),
          time: match[2].trim(),
        });
      }
    }

    log("info", `Found ${fixtureMatches.length} fixtures for today (${today})`);

    const newsCandidates: Array<{
      fixture: typeof fixtureMatches[0];
      newsTitle: string;
      newsUrl: string;
      newsBody: string;
    }> = [];

    for (const fixture of fixtureMatches) {
      const searchQuery = `${fixture.teamOne} vs ${fixture.teamTwo} cricket news`;
      const cricbuzzUrl = `https://www.cricbuzz.com/cricket-news/search?q=${encodeURIComponent(searchQuery)}`;

      try {
        const searchHtml = await browserbaseFetch(cricbuzzUrl, "html");
        const articleRegex = /<a[^>]+href="([^"]*cricket-news\/\d+\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
        let articleMatch;
        while ((articleMatch = articleRegex.exec(searchHtml)) !== null) {
          const url = articleMatch[1];
          const title = articleMatch[2].trim();
          const titleLower = title.toLowerCase();
          if (
            titleLower.includes(fixture.teamOne.toLowerCase().split(" ")[0]) ||
            titleLower.includes(fixture.teamTwo.toLowerCase().split(" ")[0])
          ) {
            newsCandidates.push({
              fixture,
              newsTitle: title,
              newsUrl: `https://www.cricbuzz.com${url.startsWith("/") ? url : ""}`,
              newsBody: "",
            });
            break;
          }
        }
      } catch (err) {
        log("warn", `Skipping news search for ${fixture.teamOne} vs ${fixture.teamTwo}: ${err.message}`);
      }
    }

    log("info", `Found ${newsCandidates.length} matches with related news`);

    const published: Array<{ fixture: string; postId: string; url: string }> = [];
    const accessToken = await refreshOauthToken();

    for (const candidate of newsCandidates.slice(0, MAX_ARTICLES_PER_DAY)) {
      const { fixture, newsTitle, newsUrl } = candidate;

      const existing = await supabaseRest("fixtures", {
        query: {
          external_id: `eq.${candidate.newsUrl}`,
          select: "id,post_url",
        },
      });
      if (existing && existing.length > 0 && existing[0].post_url) {
        log("info", `Skipping ${fixture.teamOne} vs ${fixture.teamTwo} - already published`);
        continue;
      }

      let articleBody = "";
      try {
        articleBody = await browserbaseFetch(newsUrl, "html");
      } catch (err) {
        log("warn", `Failed to fetch article ${newsUrl}: ${err.message}`);
        continue;
      }

      const { title: simpleTitle, body: simpleBody } = rewriteSimpleEnglish(articleBody, newsTitle);

      try {
        const draft = await bloggerCreateDraft(accessToken, simpleTitle, simpleBody, [
          "cricket",
          "daily",
          "news",
        ]);
        const publishedPost = await bloggerPublish(accessToken, draft.id);

        await supabaseRest("fixtures", {
          method: "PATCH",
          query: { external_id: `eq.${candidate.newsUrl}` },
          body: { post_url: publishedPost.url, updated_at: new Date().toISOString() },
          prefer: "resolution=merge-duplicates",
        });

        published.push({
          fixture: `${fixture.teamOne} vs ${fixture.teamTwo}`,
          postId: draft.id,
          url: publishedPost.url || "",
        });

        log("success", `Published: ${simpleTitle} → ${publishedPost.url}`);
      } catch (err) {
        log("error", `Failed to publish ${fixture.teamOne} vs ${fixture.teamTwo}: ${err.message}`);
      }
    }

    log("success", `=== Publisher complete: ${published.length} article(s) published ===`);
    return res.status(200).json({
      status: "ok",
      date: today,
      fixturesFound: fixtureMatches.length,
      newsFound: newsCandidates.length,
      published,
    });
  } catch (err) {
    log("error", `Publisher failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

      out = out.replace(/\b(full steam ahead|enthralling|in pole position|boiled over|shock)\b/gi, "");
      out = out.replace(/\s+/g, " ").trim();
      return out.length > 0 ? out + "." : "";
    })
    .filter(s => s.length > 0)
    .join(" ");

  const paragraphs = rewritten.split(". ").filter(p => p.length > 0);
  const htmlBody = paragraphs
    .map(p => `<p>${p.endsWith(".") ? p : p + "."}</p>`)
    .join("\n");

  const simpleTitle = title
    .replace(/at stake/i, "is at stake")
    .replace(/decider/i, "decider")
    .replace(/\b(vs|versus)\b/gi, "vs");

  return {
    title: simpleTitle.charAt(0).toUpperCase() + simpleTitle.slice(1),
    body: htmlBody,
  };
}

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Blogger create draft failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { id: string; url?: string };
}

async function bloggerPublish(accessToken: string, postId: string) {
  log("info", `Step B: Publishing Blogger post ${postId}`);
  const res = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_BLOG_ID}/posts/${postId}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Blogger publish failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { url?: string };
}

  return res.json();
}
