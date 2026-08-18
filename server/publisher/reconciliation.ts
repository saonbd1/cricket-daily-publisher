import type { NormalizedFixture } from "./normalization.js";

type ReconciliationResult = {
  fixtures: NormalizedFixture[];
  verified: number;
  candidates: number;
  conflicts: number;
};

function teamKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pairKey(fixture: NormalizedFixture) {
  return [teamKey(fixture.teamOne), teamKey(fixture.teamTwo)].sort().join("|");
}

function closeInTime(a: NormalizedFixture, b: NormalizedFixture) {
  return Math.abs(a.startTimeUtc.getTime() - b.startTimeUtc.getTime()) <= 2 * 60 * 60 * 1000;
}

function merge(primary: NormalizedFixture, secondary: NormalizedFixture, status: NormalizedFixture["verificationStatus"]): NormalizedFixture {
  return {
    ...primary,
    verificationStatus: status,
    sourceEvidence: Array.from(new Set([...primary.sourceEvidence, ...secondary.sourceEvidence])),
    matchUrl: primary.matchUrl ?? secondary.matchUrl,
    venue: primary.venue !== "Venue TBC" ? primary.venue : secondary.venue,
  };
}

export function reconcileFixtures(primary: NormalizedFixture[], secondary: NormalizedFixture[]): ReconciliationResult {
  const output: NormalizedFixture[] = [];
  const usedSecondary = new Set<number>();
  for (const fixture of primary) {
    const matchIndex = secondary.findIndex((candidate, index) => !usedSecondary.has(index) && pairKey(candidate) === pairKey(fixture) && closeInTime(candidate, fixture));
    if (matchIndex >= 0) {
      usedSecondary.add(matchIndex);
      output.push(merge(fixture, secondary[matchIndex], "verified"));
      continue;
    }
    const conflicting = secondary.some((candidate, index) => !usedSecondary.has(index) && pairKey(candidate) === pairKey(fixture));
    output.push({ ...fixture, verificationStatus: conflicting ? "conflict" : "candidate" });
  }
  secondary.forEach((fixture, index) => {
    if (!usedSecondary.has(index)) output.push({ ...fixture, verificationStatus: "candidate" });
  });
  return {
    fixtures: output,
    verified: output.filter((fixture) => fixture.verificationStatus === "verified").length,
    candidates: output.filter((fixture) => fixture.verificationStatus === "candidate").length,
    conflicts: output.filter((fixture) => fixture.verificationStatus === "conflict").length,
  };
}
