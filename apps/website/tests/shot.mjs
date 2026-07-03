// Ad-hoc section screenshot harness for the pixel-perfect loop.
// Usage:
//   node tests/shot.mjs <path> <width> <out.png> [selector|full]
// Examples:
//   node tests/shot.mjs / 1440 .design-refs/actual/desktop/home.png full
//   node tests/shot.mjs / 1440 .design-refs/actual/desktop/hero.png "#hero"
//   node tests/shot.mjs / 390  .design-refs/actual/mobile/hero.png  "#hero"
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const [, , path = "/", widthArg = "1440", out = "shot.png", mode = ""] = process.argv;
const width = parseInt(widthArg, 10);
const isFull = mode === "full";
const isSelector = mode !== "" && !isFull;
// Full-page tall captures at 2x blow past readable image limits; use 1x for full.
const deviceScaleFactor = isFull ? 1 : 2;

await mkdir(dirname(out), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor });
await page.goto(`http://localhost:8050${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

if (isSelector) {
  await page.locator(mode).first().screenshot({ path: out });
} else {
  await page.screenshot({ path: out, fullPage: isFull });
}

await browser.close();
console.log("shot ->", out, `(${width}w, ${deviceScaleFactor}x, ${mode || "viewport"})`);
