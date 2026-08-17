import { describe, expect, it } from "vitest";
import { buildSupabasePoolerConnectionString } from "./db";

describe("Supabase pooler connection builder", () => {
  it("builds the serverless URI from the current project URL and password", () => {
    expect(
      buildSupabasePoolerConnectionString(
        "https://abc123.supabase.co",
        "new password / secret",
        "ap-northeast-2",
      ),
    ).toBe(
      "postgresql://postgres.abc123:new%20password%20%2F%20secret@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres",
    );
  });

  it("returns null for malformed project URLs", () => {
    expect(buildSupabasePoolerConnectionString("abc123", "password", "ap-northeast-2")).toBeNull();
    expect(
      buildSupabasePoolerConnectionString("https://example.com", "password", "ap-northeast-2"),
    ).toBeNull();
  });
});
