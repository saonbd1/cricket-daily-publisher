import { describe, expect, it } from "vitest";
import { isPublishable, publishableFixtures } from "./service.js";
import type { NormalizedFixture } from "./normalization.js";

const base = {
  externalId: "fixture-1",
  tournamentName: "Test Series",
  teamOne: "India",
  teamTwo: "Sri Lanka",
  venue: "Test Ground",
  startTimeUtc: new Date("2026-08-18T04:30:00.000Z"),
  localDateGmt6: "2026-08-18",
  localTimeGmt6: "10:30",
  status: "scheduled" as const,
  scoreSummary: null,
  matchUrl: null,
  sourceEvidence: ["cricketdata", "thesportsdb"],
};

describe("verified-only publish gate", () => {
  it("allows verified fixtures", () => {
    expect(isPublishable({ ...base, verificationStatus: "verified" })).toBe(true);
  });

  it("blocks candidate and conflict fixtures", () => {
    expect(isPublishable({ ...base, verificationStatus: "candidate" })).toBe(false);
    expect(isPublishable({ ...base, verificationStatus: "conflict" })).toBe(false);
  });

  it("keeps non-verified fixtures out of the publishable board set", () => {
    const result = publishableFixtures([
      { ...base, externalId: "verified", verificationStatus: "verified" },
      { ...base, externalId: "candidate", verificationStatus: "candidate" },
      { ...base, externalId: "conflict", verificationStatus: "conflict" },
    ]);
    expect(result.map((item) => item.externalId)).toEqual(["verified"]);
  });
});
