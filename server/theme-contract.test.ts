import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const theme = readFileSync(resolve(process.cwd(), "theme/watchnowcricket-clean-authentic.xml"), "utf8");

describe("clean Blogger theme contract", () => {
  it("renders Blogger post bodies through the reusable post includable", () => {
    expect(theme).toContain("<b:includable id='main'>");
    expect(theme).toContain("<b:include name='super.main'/>");
    expect(theme).toContain("<b:defaultmarkup type='Blog'>");
    expect(theme).toContain("<b:section ads='true' id='page_body' class='main' name='Page Body' showaddelement='false'>");
    expect(theme).toContain("<b:includable id='post' var='post'>");
    expect(theme).toContain("<div class='post-body'><data:post.body/></div>");
  });

  it("keeps the automated fixture board and clean ticker contracts", () => {
    expect(theme).toContain("https://cricket-daily-publisher.vercel.app/api/board");
    expect(theme).toContain("LIVE CRICKET • SCORE • STREAM");
    expect(theme).toContain("cricket-live-date-value");
    expect(theme).toContain("data:blog.reportAbuseUrl");
    expect(theme).toContain("data:messages.reportAbuse");
  });

  it("contains no inherited attribution or executable third-party patterns", () => {
    for (const marker of ["rami_ba", "istockphoto", "themes.googleusercontent", "window.location", "eval(", "document.write", "fetch(", "XMLHttpRequest", "<iframe"]) {
      expect(theme.toLowerCase()).not.toContain(marker.toLowerCase());
    }
  });
});
