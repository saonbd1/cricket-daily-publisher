import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Vercel deployment configuration", () => {
  it("serves the React build output instead of the server bundle", () => {
    const configPath = path.resolve(process.cwd(), "vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      outputDirectory?: string;
      rewrites?: Array<{ source: string; destination: string }>;
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(config.outputDirectory).toBe("dist/public");
    expect(config.rewrites).toContainEqual({
      source: "/api/:path*",
      destination: "/api/index.js",
    });
    expect(config.crons).toContainEqual({
      path: "/api/cron/publish-cricket",
      schedule: "5 18 * * *",
    });
  });
});
