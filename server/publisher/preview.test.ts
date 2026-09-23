import { describe, expect, it } from "vitest";
import { generateMatchPreview } from "./preview.js";

describe("Match preview generation", () => {
  it("returns null without throwing when no LLM proxy is configured", async () => {
    // BUILT_IN_FORGE_API_KEY is not set in the test environment, so this
    // exercises the same fallback path a production deploy hits until the
    // operator opts in by configuring the LLM proxy env vars.
    const preview = await generateMatchPreview({
      teamOne: "Dhaka",
      teamTwo: "Chattogram",
      tournamentName: "National T20",
      venue: "Mirpur",
      localDateGmt6: "2026-08-17",
      localTimeGmt6: "16:00",
      status: "scheduled",
    });
    expect(preview).toBeNull();
  });
});
