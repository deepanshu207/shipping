/**
 * Regression: full-length collage-style mode — studio ~₹55 + framed ~₹66, no ₹198 outliers.
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
  for (let y = 220; y < 1580; y += 12) {
    for (let x = 270; x < 630; x += 12) {
      ctx.fillStyle = (x + y) % 24 === 0 ? "#fbbf24" : "#7c3aed";
      ctx.fillRect(x, y, 8, 8);
    }
  }
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
const topEst = sorted[0]?.estimatedShippingInr || 99;
const hasFramed = results.some((r) => String(r.processingPath || "").includes("framed"));
const hasStudio = results.some((r) => String(r.processingPath || "").includes("portrait"));
const bad198 = results.filter((r) => (r.fileSizeKb || 0) > 100 || (r.estimatedShippingInr || 0) > 120);
const has66 = results.some((r) => r.estimatedShippingInr === 66);

console.log(
  `variants=${results.length} topEst=₹${topEst} framed=${hasFramed} studio=${hasStudio} has66=${has66} bad198=${bad198.length}`
);
if (results.length < 20) {
  console.error("FAIL: expected at least 20 variants");
  process.exit(1);
}
if (!hasFramed) {
  console.error("FAIL: missing framed full-length scenarios");
  process.exit(1);
}
if (!hasStudio) {
  console.error("FAIL: missing studio full-length scenarios");
  process.exit(1);
}
if (bad198.length > 0) {
  console.error("FAIL: ₹198-style outliers:", bad198.slice(0, 3));
  process.exit(1);
}
if (topEst > 71) {
  console.error("FAIL: top estimate too high:", topEst);
  process.exit(1);
}
console.log("OK  full-length collage mode");
