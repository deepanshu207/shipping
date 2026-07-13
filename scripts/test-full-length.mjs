/**
 * Regression: full-length mode fits tall images into capped canvases.
 */
import { chromium } from "playwright";

const port = Number(process.env.PORT || 8000);

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/optimizer-shell.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.MeeshoProcessor?.optimize, null, { timeout: 120000 });

const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 900;
  c.height = 1800;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 900, 1800);
  ctx.fillStyle = "#9333ea";
  ctx.fillRect(250, 200, 400, 1400);
  return c.toDataURL("image/jpeg", 0.92);
});

const results = await page.evaluate(
  async ({ dataUrl, tag }) => window.MeeshoProcessor.optimize(dataUrl, tag, {}),
  {
    dataUrl,
    tag: "Full-length enlarged dress kaftan saree lowest shipping",
  }
);

await browser.close();

const sorted = [...results].sort(
  (a, b) =>
    a.estimatedShippingInr - b.estimatedShippingInr ||
    Math.max(a.width || 0, a.height || 0) - Math.max(b.width || 0, b.height || 0)
);
const topMax = Math.max(...sorted.slice(0, 5).map((r) => Math.max(r.width || 0, r.height || 0)));
const has580 = results.some((r) => String(r.modeName || "").includes("580×870"));
console.log(`variants=${results.length} top5MaxSide=${topMax} fit580=${has580}`);
if (results.length < 10) {
  console.error("FAIL: expected at least 10 variants");
  process.exit(1);
}
if (topMax > 960) {
  console.error("FAIL: top-5 max outer side too large:", topMax);
  process.exit(1);
}
if (!has580) {
  console.error("FAIL: missing 580×870 scenario");
  process.exit(1);
}
if ((sorted[0].estimatedShippingInr || 99) > 55) {
  console.error("FAIL: top estimate too high:", sorted[0].estimatedShippingInr);
  process.exit(1);
}
console.log("OK  full-length mode");
