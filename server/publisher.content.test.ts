import { describe, expect, it } from "vitest";
import { fixtureMarker, postContent } from "./publisher/service.js";
import { normalizeFixture } from "./publisher/normalization.js";
import { findMatchingBloggerPost } from "./publisher/blogger.js";
import type { NormalizedFixture } from "./publisher/normalization.js";

const fixture: NormalizedFixture = {
  externalId: "fixture-42",
  tournamentName: "National T20",
  teamOne: "Dhaka",
  teamTwo: "Chattogram",
  venue: "Mirpur",
  startTimeUtc: new Date("2026-08-17T10:00:00.000Z"),
  localDateGmt6: "2026-08-17",
  localTimeGmt6: "16:00",
  status: "live",
  scoreSummary: "Dhaka 120/3",
  matchUrl: "https://example.com/match/42",
};

describe("Blogger match content", () => {
  it("uses a stable external fixture marker for reconciliation", () => {
    expect(fixtureMarker(fixture)).toBe('data-cricket-fixture="fixture-42"');
  });

  it("maps provider status transitions to the internal lifecycle", () => {
    expect(normalizeFixture({ id: "a", dateTimeGMT: "2026-08-17T10:00:00Z", teams: ["A", "B"], status: "In Progress" }).status).toBe("live");
    expect(normalizeFixture({ id: "b", dateTimeGMT: "2026-08-17T10:00:00Z", teams: ["A", "B"], status: "Match Finished" }).status).toBe("completed");
    expect(normalizeFixture({ id: "c", dateTimeGMT: "2026-08-17T10:00:00Z", teams: ["A", "B"], status: "Match Postponed" }).status).toBe("postponed");
  });

  it("embeds SportsEvent JSON-LD and the current status", () => {
    const html = postContent(fixture);
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"SportsEvent"');
    expect(html).toContain("Dhaka 120/3");
    expect(html).toContain("data-cricket-fixture=\"fixture-42\"");
  });

  it("reconciles a matching Blogger marker when local state is absent", () => {
    const post = findMatchingBloggerPost([{ id: "post-42", url: "https://watchnowcricket.blogspot.com/p/post-42.html", content: '<article data-cricket-fixture="fixture-42"></article>' }], 'data-cricket-fixture="fixture-42"');
    expect(post?.id).toBe("post-42");
  });
});
