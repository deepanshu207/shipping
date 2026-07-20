/**
 * Raincoat Lowest ₹ — multi-scenario framed indoor path targets ~₹63 band.
 */
import { chromium } from "playwright";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] || "http://localhost:8000";

function startServer() {
  return spawn("python3", ["server.py"], { cwd: ROOT, stdio: "ignore" });
}

async function waitForServer(url) {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch(`${url}/`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server not ready");
}

async function run() {
  let server;
  if (BASE.includes("localhost")) {
    server = startServer();
    await waitForServer(BASE);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/?v=137`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoProcessor?.optimize, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 900;
      c.height = 1400;
      const ctx = c.getContext("2d");
      for (let y = 0; y < 1400; y += 3) {
        for (let x = 0; x < 900; x += 3) {
          const floor = y > 900;
          ctx.fillStyle = floor
            ? `rgb(${90 + (x % 40)},${88 + (y % 35)},${92 + ((x * y) % 30)})`
            : `rgb(${238 + (x % 8)},${236 + (y % 6)},${232 + ((x + y) % 5)})`;
          ctx.fillRect(x, y, 3, 3);
        }
      }
      ctx.fillStyle = "#8B5CF6";
      ctx.fillRect(280, 180, 340, 980);
      const dataUrl = c.toDataURL("image/jpeg", 0.92);

      const tag = "Raincoat indoor busy lowest shipping framed";
      const variants = await window.MeeshoProcessor.optimize(dataUrl, tag, {
        borderColor: "#556B2F",
        stickerTemplate: "raincoat_promo",
      });

      const inrs = variants.map((v) => Number(v.estimatedShippingInr || v.shippingCharge || 0));
      const bytes = variants.map((v) => v.fileSizeBytes || 0);
      const paths = [...new Set(variants.map((v) => v.processingPath))];
      const maxSides = variants.map((v) => Math.max(v.width || 0, v.height || 0));
      const best = variants[0];
      const bestDimsOk = best?.width === 1024 && best?.height === 1024;
      const bestStyle = best?.reframeMeta?.frameStyle || {};
      const oliveForced = String(bestStyle.borderColor || "").toUpperCase() === "#556B2F";
      const hasPromoVariant = variants.some(
        (v) => v.reframeMeta?.frameStyle?.stickerTemplate === "raincoat_promo"
      );
      const stickerTypes = variants[0]?.reframeMeta?.frameStyle?.stickerLayout?.stickers?.map((s) => s.type) || [];
      const hasMatchStickers =
        stickerTypes.includes("special_offer_burst") &&
        stickerTypes.includes("special_sale") &&
        stickerTypes.includes("best_seller");
      const allWithinSlab = bytes.every((b) => b <= 68 * 1024);

      return {
        count: variants.length,
        minInr: Math.min(...inrs),
        maxInr: Math.max(...inrs),
        minBytes: Math.min(...bytes),
        maxBytes: Math.max(...bytes),
        maxSide: Math.max(...maxSides),
        paths,
        hasRaincoatPath: paths.includes("raincoat_framed"),
        oliveForced,
        hasPromoVariant,
        hasMatchStickers,
        allWithinSlab,
        inrAtMost66: inrs.every((n) => n <= 66),
        maxSideAtMost1024: maxSides.every((n) => n <= 1024),
        isSquare1024: bestDimsOk,
        bestDimsOk,
        bestDims: `${best?.width}×${best?.height}`,
        best,
      };
    });

    const ok =
      result.count >= 20 &&
      result.count <= 30 &&
      result.hasRaincoatPath &&
      result.oliveForced &&
      result.hasPromoVariant &&
      result.hasMatchStickers &&
      result.allWithinSlab &&
      result.inrAtMost66 &&
      result.maxSideAtMost1024 &&
      result.isSquare1024 &&
      result.bestDimsOk &&
      result.minInr <= 66;

    if (!ok) {
      console.error("FAIL", result);
      process.exit(1);
    }
    console.log("OK", JSON.stringify(result));
  } finally {
    await browser.close();
    if (server) server.kill("SIGTERM");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
