/**
 * Diagnose full-length variants — dimensions, KB, est. ₹ for tall kaftan-like image.
 */
import { chromium } from "playwright";

const port = Number(process.env.PORT || 8000);
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/optimizer-shell.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.MeeshoProcessor?.optimize, null, { timeout: 120000 });

const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 1000;
  c.height = 2000;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1000, 2000);
  ctx.fillStyle = "#7c3aed";
  ctx.fillRect(200, 150, 600, 1700);
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(350, 400, 300, 900);
  return c.toDataURL("image/jpeg", 0.92);
});

const results = await page.evaluate(
  async ({ dataUrl, tag }) => window.MeeshoProcessor.optimize(dataUrl, tag, {}),
  { dataUrl, tag: "Full-length enlarged dress kaftan saree lowest shipping" }
);

await browser.close();

const rows = results
  .map((r) => ({
    est: r.estimatedShippingInr,
    kb: r.fileSizeKb,
    dim: `${r.width}×${r.height}`,
    mode: (r.modeName || r.tagName || "").slice(0, 55),
    path: r.processingPath,
  }))
  .sort((a, b) => a.est - b.est || a.kb - b.kb);

console.log("Top 15 by est. ₹:\n");
rows.slice(0, 15).forEach((r, i) => {
  console.log(
    `${String(i + 1).padStart(2)}. ₹${String(r.est).padStart(3)} | ${String(r.kb).padStart(2)}KB | ${r.dim.padEnd(12)} | ${r.path.padEnd(22)} | ${r.mode}`
  );
});
console.log(`\nTotal variants: ${results.length}`);
console.log(`Min est: ₹${rows[0]?.est} | Max outer side in top5: ${Math.max(...rows.slice(0, 5).map((r) => Math.max(...r.dim.split("×").map(Number))))}`);
