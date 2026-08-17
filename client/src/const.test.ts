import { describe, expect, it } from "vitest";
import { OAUTH_START_PATH } from "./const";

describe("frontend Google OAuth login launch", () => {
  it("uses the runtime server endpoint so Vercel does not expose Google secrets", () => {
    expect(OAUTH_START_PATH).toBe("/api/google/start");
  });
});
