import fs from "node:fs";
import path from "node:path";

const roots = ["server", "api"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const importPattern = /(\bfrom\s+["']|\bimport\s*["'])(\.\.?\/[^"']+)(["'])/g;

for (const root of roots) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (sourceExtensions.has(path.extname(entry.name))) files.push(target);
    }
  };
  walk(root);

  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");
    const updated = original.replace(importPattern, (full, prefix, specifier, quote) => {
      if (path.extname(specifier)) return full;
      return `${prefix}${specifier}.js${quote}`;
    });
    if (updated !== original) fs.writeFileSync(file, updated);
  }
}
