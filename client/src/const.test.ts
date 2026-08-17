import { describe, expect, it } from "vitest";
import { OAUTH_START_PATH } from "./const";

describe("frontend OAuth login launch", () => {
  it("uses the runtime server endpoint so Vercel does not need public OAuth secrets", () => {
    expect(OAUTH_START_PATH).toBe("/api/oauth/start");
  });
});
