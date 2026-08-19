import { describe, expect, it } from "vitest";
import { preserveExistingVerification } from "./verification-preservation.js";
import type { NormalizedFixture } from "./normalization.js";

const fixture = (verificationStatus: NormalizedFixture["verificationStatus"], sourceEvidence: string[]): NormalizedFixture => ({
  externalId: "fixture-1",
  tournamentName: "TNPL",
  teamOne: "Team A",
  teamTwo: "Team B",
  venue: "Ground",
  startTimeUtc: new Date("2026-08-20T10:00:00.000Z"),
  localDateGmt6: "2026-08-20",
  localTimeGmt6: "16:00",
  status: "scheduled",
  scoreSummary: null,
  matchUrl: null,
  verificationStatus,
  sourceEvidence,
});

describe("preserveExistingVerification", () => {
  it("does not downgrade an existing verified fixture", () => {
    const result = preserveExistingVerification(fixture("candidate", ["cricketdata"]), {
      verificationStatus: "verified",
      sourceEvidence: '["cricketdata","cricbuzz"]',
    });
    expect(result.verificationStatus).toBe("verified");
    expect(JSON.parse(result.sourceEvidence)).toEqual(["cricketdata", "cricbuzz"]);
  });

  it("merges newly observed sources into existing evidence", () => {
    const result = preserveExistingVerification(fixture("candidate", ["thesportsdb"]), {
      verificationStatus: "verified",
      sourceEvidence: '["cricketdata","bcci"]',
    });
    expect(JSON.parse(result.sourceEvidence)).toEqual(["cricketdata", "bcci", "thesportsdb"]);
  });

  it("accepts a genuinely verified incoming fixture", () => {
    const result = preserveExistingVerification(fixture("verified", ["cricketdata", "bcci"]), {
      verificationStatus: "candidate",
      sourceEvidence: '["cricketdata"]',
    });
    expect(result.verificationStatus).toBe("verified");
    expect(JSON.parse(result.sourceEvidence)).toEqual(["cricketdata", "bcci"]);
  });
});
