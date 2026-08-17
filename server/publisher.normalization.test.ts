import { describe, expect, it } from "vitest";
import { formatGmt6, normalizeFixture } from "./publisher/normalization.js";

describe("fixture normalization", () => {
  it("converts an ISO UTC start time to Bangladesh time without changing the instant", () => {
    const fixture = normalizeFixture({
      id: "fixture-1",
      name: "Bangladesh vs India",
      dateTimeGMT: "2026-08-17T12:30:00Z",
      league: { name: "Asia Cup" },
      teams: ["Bangladesh", "India"],
      venue: "Dhaka",
      status: "Scheduled",
    });

    expect(fixture.externalId).toBe("fixture-1");
    expect(fixture.localDateGmt6).toBe("2026-08-17");
    expect(fixture.localTimeGmt6).toBe("18:30");
    expect(formatGmt6(fixture.startTimeUtc)).toBe("17 Aug 2026, 18:30 GMT+6");
  });

  it("falls back safely when the provider omits a second team or venue", () => {
    const fixture = normalizeFixture({
      id: "fixture-2",
      name: "Warm-up",
      dateTimeGMT: "2026-08-18T00:00:00Z",
      league: { name: "Other" },
      teams: ["Team A"],
    });

    expect(fixture.teamOne).toBe("Team A");
    expect(fixture.teamTwo).toBe("TBC");
    expect(fixture.venue).toBe("Venue TBC");
  });
});
