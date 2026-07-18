/**
 * Regression: SupplierDen mode outputs exact 703×1024 framed variants for tall kaftan photos.
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
  ctx.fillStyle = "#0d9488";
  ctx.beginPath();
  ctx.moveTo(450, 220);
  ctx.lineTo(620, 520);
  ctx.lineTo(580, 1650);
  ctx.lineTo(320, 1650);
  ctx.lineTo(280, 520);
  ctx.closePath();
  ctx.fill();
  return c.toDataURL("image/jpeg", 0.92);
});

const results = await page.evaluate(
  async ({ dataUrl, tag }) => window.MeeshoProcessor.optimize(dataUrl, tag, {}),
  {
    dataUrl,
    tag: "Tall dress kaftan ₹50 supplierden lowest shipping",
  }
);

await browser.close();

const exact703 = results.filter((r) => r.width === 703 && r.height === 1024);
const maxSide = Math.max(...results.map((r) => Math.max(r.width || 0, r.height || 0)));
const top = results[0];

console.log(
  `variants=${results.length} exact703=${exact703.length} maxSide=${maxSide} top=${top?.width}×${top?.height} est=₹${top?.estimatedShippingInr}`
);

if (results.length < 10) {
  console.error("FAIL: expected at least 10 SupplierDen variants");
  process.exit(1);
}
if (!exact703.length) {
  console.error("FAIL: missing exact 703×1024 variants");
  process.exit(1);
}
if (top.width !== 703 || top.height !== 1024) {
  console.error("FAIL: #1 ranked variant should be exact 703×1024, got", top.width, top.height);
  process.exit(1);
}
if (maxSide > 1024) {
  console.error("FAIL: max outer side too large:", maxSide);
  process.exit(1);
}
console.log("OK  supplierden mode");
