import { chromium } from "@playwright/test";
const [, , path, width, out, ...clicks] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +width, height: 900 }, deviceScaleFactor: 2 });
await p.goto(`http://localhost:8050${path}`, { waitUntil: "networkidle" });
for (const c of clicks) { await p.getByText(c, { exact: true }).first().click(); await p.waitForTimeout(250); }
await p.locator("#rails-dx").first().screenshot({ path: out });
await b.close();
console.log("shot ->", out);
