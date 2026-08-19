import type { NormalizedFixture } from "./normalization.js";

export type ExistingVerification = {
  verificationStatus?: string | null;
  sourceEvidence?: string | null;
};

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
