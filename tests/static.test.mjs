import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("GitHub Pages assets and PWA scope use project-relative paths", async () => {
  const [html, manifest, worker] = await Promise.all([
    readFile(new URL("../src/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../src/sw.js", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(html, /(?:src|href)="\//);
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.start_url, "./");
  assert.equal(parsed.scope, "./");
  assert.match(worker, /\.\/index\.html/);
  assert.match(html, /apple-touch-icon/);
});

test("service worker pre-caches every essential application module", async () => {
  const worker = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");
  for (const asset of ["index.html", "styles.css", "manifest.webmanifest", "js/app.js", "js/db.js", "js/stats.js", "js/exports.js", "icon-192.png", "icon-512.png"]) assert.ok(worker.includes(asset), `missing ${asset}`);
});
