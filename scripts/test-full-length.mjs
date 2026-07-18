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

const maxSide = Math.max(...results.map((r) => Math.max(r.width || 0, r.height || 0)));
const hasFit703 = results.some((r) => String(r.modeName || "").includes("703"));
const hasCapped = results.some((r) => String(r.modeName || "").includes("capped"));

console.log(`variants=${results.length} maxSide=${maxSide} fit703=${hasFit703} capped=${hasCapped}`);
if (results.length < 10) {
  console.error("FAIL: expected at least 10 variants");
  process.exit(1);
}
if (maxSide > 1100) {
  console.error("FAIL: max outer side too large:", maxSide);
  process.exit(1);
}
if (!hasFit703) {
  console.error("FAIL: missing fit 703×1024 scenario");
  process.exit(1);
}
console.log("OK  full-length mode");
