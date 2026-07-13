/**
 * Regression: full-length uses Collage pipeline (lowered square/panel + extras).
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
const topMax = Math.max(...sorted.slice(0, 5).map((r) => Math.max(r.width || 0, r.height || 0)));
const hasSquare = results.some((r) => String(r.processingPath || "") === "full_length_square");
const hasPortrait = results.some((r) => String(r.processingPath || "") === "full_length_portrait");
const hasFramed = results.some((r) => String(r.processingPath || "") === "full_length_framed");
const bad198 = results.filter((r) => (r.fileSizeKb || 0) > 100 || (r.estimatedShippingInr || 0) > 120);

console.log(
  `variants=${results.length} topEst=₹${topEst} top5Max=${topMax} sq=${hasSquare} pt=${hasPortrait} framed=${hasFramed} bad=${bad198.length}`
);
if (results.length < 20) {
  console.error("FAIL: expected at least 20 variants");
  process.exit(1);
}
if (!hasSquare) {
  console.error("FAIL: missing collage-style square scenarios");
  process.exit(1);
}
if (!hasPortrait) {
  console.error("FAIL: missing full-length-only portrait/cap scenarios");
  process.exit(1);
}
if (!hasFramed) {
  console.error("FAIL: missing framed mirrors");
  process.exit(1);
}
if (topMax > 1100) {
  console.error("FAIL: top-5 max side too large (dims not lowered):", topMax);
  process.exit(1);
}
if (bad198.length > 0) {
  console.error("FAIL: ₹198-style outliers");
  process.exit(1);
}
if (topEst > 71) {
  console.error("FAIL: top estimate too high:", topEst);
  process.exit(1);
}
console.log("OK  full-length collage pipeline");
