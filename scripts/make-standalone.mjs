// Inlines the built chords app (dist-chords/chords.html + its hashed JS/CSS
// assets) into a single self-contained HTML file that works from file:// with
// no network access. Output: dist-chords/DayFretChords.html
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist-chords");

let html = readFileSync(resolve(distDir, "chords.html"), "utf8");

const asset = (path) => readFileSync(resolve(distDir, path), "utf8");

let inlinedJs = 0;
let inlinedCss = 0;

html = html.replace(
  /<script type="module"[^>]*src="\/?(assets\/[^"]+\.js)"><\/script>/g,
  (_, path) => {
    inlinedJs += 1;
    return `<script type="module">${asset(path)}</script>`;
  },
);

html = html.replace(
  /<link rel="stylesheet"[^>]*href="\/?(assets\/[^"]+\.css)"[^>]*>/g,
  (_, path) => {
    inlinedCss += 1;
    return `<style>${asset(path)}</style>`;
  },
);

html = html.replace(/<link rel="modulepreload"[^>]*>\n?/g, "");

if (inlinedJs !== 1 || inlinedCss !== 1) {
  console.error(`Expected exactly 1 JS and 1 CSS asset, got ${inlinedJs} JS / ${inlinedCss} CSS`);
  process.exit(1);
}
if (/(src|href)="\/?assets\//.test(html)) {
  console.error("Output still references external assets — inlining incomplete");
  process.exit(1);
}

const outPath = resolve(distDir, "DayFretChords.html");
writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(0)} KB)`);
