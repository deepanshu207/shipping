/**
 * Regression: full-length collage pipeline + tight crop scenarios.
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
  { dataUrl, tag: "Full-length enlarged dress kaftan saree lowest shipping" }
);

const catalog = await page.evaluate(() => window.MeeshoReframe?.fullLengthDimensionCatalog?.() || []);

await browser.close();

const sorted = [...results].sort((a, b) => a.estimatedShippingInr - b.estimatedShippingInr);
const topEst = sorted[0]?.estimatedShippingInr || 99;
const topMax = Math.max(...sorted.slice(0, 5).map((r) => Math.max(r.width || 0, r.height || 0)));
const hasCrop = results.some((r) => String(r.modeName || "").includes("tight crop"));
const hasFramed = results.some((r) => r.processingPath === "full_length_framed");
const bad = results.filter((r) => (r.fileSizeKb || 0) > 100 || (r.estimatedShippingInr || 0) > 120);

console.log(
  `variants=${results.length} topEst=₹${topEst} top5Max=${topMax} crop=${hasCrop} framed=${hasFramed} catalog=${catalog.length} bad=${bad.length}`
);
if (results.length < 20) {
  console.error("FAIL: expected at least 20 variants");
  process.exit(1);
}
if (!hasCrop) {
  console.error("FAIL: missing tight-crop scenarios");
  process.exit(1);
}
if (catalog.length < 15) {
  console.error("FAIL: dimension catalog too small:", catalog.length);
  process.exit(1);
}
if (topMax > 750) {
  console.error("FAIL: top-5 max side too large:", topMax);
  process.exit(1);
}
if (bad.length > 0) {
  console.error("FAIL: outliers");
  process.exit(1);
}
console.log("OK  full-length crop + catalog");
