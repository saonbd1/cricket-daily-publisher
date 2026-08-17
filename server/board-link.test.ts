import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("stable Blogger board link", () => {
  it("keeps persistence, redirect, and theme integration aligned", () => {
    const schema = read("drizzle/schema.ts");
    const db = read("server/publisher/db.ts");
    const routes = read("server/publisher/routes.ts");
    const service = read("server/publisher/service.ts");
    const theme = fs.readFileSync("/home/ubuntu/cricket-online-watch-security-clean.xml", "utf8");

    expect(schema).toContain('boardPostUrl: text("boardPostUrl")');
    expect(db).toContain("saveBoardPostUrl");
    expect(db).toContain("getBoardPostUrl");
    expect(routes).toContain('app.get("/api/board"');
    expect(routes).toContain("res.redirect(boardUrl)");
    expect(service).toContain("await saveBoardPostUrl(boardUrl)");
    expect(theme).toContain("https://cricket-daily-publisher.vercel.app/api/board");
    expect(theme).not.toContain("search/label/homepage-board");
  });
});
