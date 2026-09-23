import { ENV } from "../_core/env.js";
import { invokeLLM } from "../_core/llm.js";
import type { NormalizedFixture } from "./normalization.js";
import type { TextContent, ImageContent, FileContent } from "../_core/llm.js";

const MAX_PREVIEW_WORDS = 130;

export type PreviewFixtureInput = Pick<
  NormalizedFixture,
  "teamOne" | "teamTwo" | "tournamentName" | "venue" | "localDateGmt6" | "localTimeGmt6" | "status"
>;

const SYSTEM_PROMPT =
  "You are a factual sports-desk assistant writing short match previews for a cricket fixture blog. " +
  "You only use the details you are given. You never invent scores, player names, statistics, weather, " +
  "team form, head-to-head history, or a predicted winner.";

function buildPrompt(fixture: PreviewFixtureInput) {
  return [
    "Write a preview paragraph for this cricket fixture, aimed at a fan checking the day's match schedule.",
    "Rules:",
    "- Write 3 to 4 full sentences (one solid paragraph, roughly 70-110 words), plain text only, no markdown, no headings, no hashtags, no emoji.",
    "- Sentence 1: introduce the matchup — both teams, the tournament, and the venue.",
    "- Sentence 2: note the scheduled date/time and what a fan can expect to follow (live score, match updates).",
    "- Sentence 3 (and 4 if useful): general, non-speculative context about the occasion — e.g. the format of the tournament, why the fixture matters to the competition, or an invitation to follow along — using only the details provided.",
    "- Do not invent facts that are not listed below: no scores, player names, statistics, weather, team form, or head-to-head history.",
    "- Do not predict a winner, mention betting, or use odds.",
    "- Do not pad with generic filler sentences that repeat the same fact twice.",
    "",
    `Team 1: ${fixture.teamOne}`,
    `Team 2: ${fixture.teamTwo}`,
    `Tournament: ${fixture.tournamentName}`,
    `Venue: ${fixture.venue}`,
    `Scheduled: ${fixture.localDateGmt6} at ${fixture.localTimeGmt6} (GMT+6)`,
    `Status: ${fixture.status}`,
  ].join("\n");
}

function extractText(content: string | Array<TextContent | ImageContent | FileContent>): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is TextContent => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join(" ");
}

function clampWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function sanitize(raw: string) {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']|["']$/g, "");
}

// Generates a short, neutral match preview from fixture metadata using the
// configured LLM proxy (BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY).
// Returns null (never throws) when the LLM is not configured or the call
// fails, so a preview outage never blocks fixture publishing.
export async function generateMatchPreview(fixture: PreviewFixtureInput): Promise<string | null> {
  if (!ENV.forgeApiKey) return null;
  try {
    const result = await invokeLLM({
      model: ENV.matchPreviewModel || undefined,
      // openai/gpt-oss-* models on Groq spend some of maxTokens on hidden
      // reasoning before the visible answer, so budget well above the ~150
      // tokens the visible paragraph needs to avoid truncation.
      maxTokens: 500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(fixture) },
      ],
    });
    const raw = result.choices?.[0]?.message?.content;
    if (!raw) return null;
    const text = sanitize(extractText(raw));
    if (!text) return null;
    return clampWords(text, MAX_PREVIEW_WORDS);
  } catch (error) {
    console.error("Match preview generation failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
