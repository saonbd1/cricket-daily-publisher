import { describe, expect, it } from "vitest";
import { reconcileFixtures } from "./reconciliation.js";
import type { NormalizedFixture } from "./normalization.js";

function fixture(overrides: Partial<NormalizedFixture> = {}): NormalizedFixture {
  return {
    externalId: "primary-1",
    tournamentName: "Test Series",
    teamOne: "India",
    teamTwo: "Sri Lanka",
    venue: "Test Ground",
    startTimeUtc: new Date("2026-08-18T04:30:00.000Z"),
    localDateGmt6: "2026-08-18",
    localTimeGmt6: "10:30",
    status: "scheduled",
    scoreSummary: null,
    matchUrl: null,
    verificationStatus: "verified",
    sourceEvidence: ["cricketdata"],
    ...overrides,
  };
}

describe("reconcileFixtures", () => {
  it("marks matching teams and close start times as verified", () => {
    const result = reconcileFixtures([fixture()], [fixture({ externalId: "secondary-1", sourceEvidence: ["thesportsdb"] })]);
    expect(result.verified).toBe(1);
    expect(result.candidates).toBe(0);
    expect(result.fixtures[0].sourceEvidence).toEqual(["cricketdata", "thesportsdb"]);
  });

  it("keeps source-only events as candidates", () => {
    const result = reconcileFixtures([], [fixture({ externalId: "secondary-1", sourceEvidence: ["thesportsdb"] })]);
    expect(result.verified).toBe(0);
    expect(result.candidates).toBe(1);
    expect(result.fixtures[0].verificationStatus).toBe("candidate");
  });

  it("marks same-team time disagreements as conflicts", () => {
    const result = reconcileFixtures([fixture()], [fixture({ externalId: "secondary-1", startTimeUtc: new Date("2026-08-18T12:30:00.000Z"), sourceEvidence: ["thesportsdb"] })]);
    expect(result.conflicts).toBe(1);
    expect(result.fixtures[0].verificationStatus).toBe("conflict");
  });
});
