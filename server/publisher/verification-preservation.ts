import type { NormalizedFixture } from "./normalization.js";

export type ExistingVerification = {
  verificationStatus?: string | null;
  sourceEvidence?: string | null;
};

export function persistedVerificationFixture(
  fixture: NormalizedFixture,
  saved: ExistingVerification,
): NormalizedFixture {
  let sourceEvidence = fixture.sourceEvidence;
  if (saved.sourceEvidence) {
    try {
      const parsed = JSON.parse(saved.sourceEvidence);
      if (Array.isArray(parsed)) sourceEvidence = parsed.filter((value): value is string => typeof value === "string");
    } catch {
      sourceEvidence = fixture.sourceEvidence;
    }
  }
  return {
    ...fixture,
    verificationStatus: saved.verificationStatus === "verified" ? "verified" : fixture.verificationStatus,
    sourceEvidence,
  };
}

export function preserveExistingVerification(
  fixture: NormalizedFixture,
  existing?: ExistingVerification,
) {
  if (existing?.verificationStatus !== "verified" || fixture.verificationStatus === "verified") {
    return {
      verificationStatus: fixture.verificationStatus,
      sourceEvidence: JSON.stringify(fixture.sourceEvidence),
    };
  }

  let previous: string[] = [];
  if (existing.sourceEvidence) {
    try {
      const parsed = JSON.parse(existing.sourceEvidence);
      if (Array.isArray(parsed)) previous = parsed.filter((value): value is string => typeof value === "string");
    } catch {
      previous = [];
    }
  }
  const merged = Array.from(new Set([...previous, ...fixture.sourceEvidence]));
  return {
    verificationStatus: "verified" as const,
    sourceEvidence: JSON.stringify(merged),
  };
}
