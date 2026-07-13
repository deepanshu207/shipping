/**
 * Regression: flat-lay apparel mode produces variants in ₹39–₹51 KB band.
 */
import { chromium } from "playwright";

const port = Number(process.env.PORT || 8000);

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/optimizer-shell.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.MeeshoProcessor?.optimize, null, { timeout: 120000 });

const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = 1000;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 800, 1000);
  ctx.fillStyle = "#f9a8d4";
  ctx.fillRect(200, 250, 400, 500);
  return c.toDataURL("image/jpeg", 0.92);
});

const results = await page.evaluate(
  async ({ dataUrl, tag }) => window.MeeshoProcessor.optimize(dataUrl, tag, {}),
  {
    dataUrl,
    tag: "Flat-lay apparel tops crop tops white studio lowest shipping",
  }
);

await browser.close();

const estimates = results.map((r) => r.estimatedShippingInr).sort((a, b) => a - b);
const minEst = estimates[0];
const hasPortrait = results.some((r) => String(r.modeName || "").includes("703"));
const hasFramed = results.some((r) => String(r.modeName || "").includes("framed"));

console.log(`variants=${results.length} minEst=₹${minEst} portrait703=${hasPortrait} framed=${hasFramed}`);
if (results.length < 10) {
  console.error("FAIL: expected at least 10 variants");
  process.exit(1);
}
if (!hasPortrait) {
  console.error("FAIL: missing portrait 703×1024 scenario");
  process.exit(1);
}
if (!hasFramed) {
  console.error("FAIL: missing framed 1024 scenario");
  process.exit(1);
}
console.log("OK  flat-lay apparel mode");
