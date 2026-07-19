/**
 * Raincoat post-generation reframe — busy background preserved, shipping locked.
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
    await page.goto(`${BASE}/?v=131`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoProcessor?.optimize && window.MeeshoReframe, {
      timeout: 20000,
    });

    const result = await page.evaluate(async () => {
      const MR = window.MeeshoReframe;
      const MP = window.MeeshoProcessor;

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

      const loadImg = () =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = dataUrl;
        });

      const tag = "Raincoat indoor busy lowest shipping framed";
      const variants = await MP.optimize(dataUrl, tag, {
        borderColor: "#FF7900",
        stickerTemplate: "classic_promo",
      });
      const best = variants[0];
      const meta = best.reframeMeta;
      const genInr = best.estimatedShippingInr;
      const genStyle = meta.frameStyle || {};

      const oliveOk = String(genStyle.borderColor || "").toUpperCase() === "#6B7C3C";
      const promoOk = genStyle.stickerTemplate === "raincoat_promo";
      const lowShipping = genInr <= 66;

      const anchored = {
        ...meta,
        tier: {
          ...meta.tier,
          anchorBytes: best.fileSizeBytes,
          preserveBytes: best.fileSizeBytes,
          anchorInr: genInr,
          anchorWidth: best.width,
          anchorHeight: best.height,
          preserveKb: best.fileSizeKb,
        },
      };

      const reframed = await MR.renderCustomVariant(await loadImg(), anchored, "framed", {
        borderColor: "#1565C0",
        stickerTemplate: "raincoat_promo",
        borderWidthPreset: "standard",
        borderWidthAdjust: 100,
      });
      const lockedInr = MR.estimateReframeShippingInr(reframed, anchored);

      const canvas = document.createElement("canvas");
      canvas.width = reframed.width;
      canvas.height = reframed.height;
      const rctx = canvas.getContext("2d");
      const blobUrl = URL.createObjectURL(reframed.blob);
      await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => {
          rctx.drawImage(i, 0, 0);
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        i.onerror = reject;
        i.src = blobUrl;
      });
      const { data, width, height } = rctx.getImageData(0, 0, canvas.width, canvas.height);
      let near = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) near++;
      }
      const nearWhiteRatio = near / (width * height);

      return {
        oliveOk,
        promoOk,
        lowShipping,
        genInr,
        shippingLocked: lockedInr === genInr,
        bytesWithinCap: reframed.bytes <= best.fileSizeBytes,
        nearWhiteRatio,
        noWhitePatch: nearWhiteRatio < 0.35,
        profileId: meta.profileId,
      };
    });

    const ok =
      result.oliveOk &&
      result.promoOk &&
      result.lowShipping &&
      result.shippingLocked &&
      result.bytesWithinCap &&
      result.noWhitePatch &&
      String(result.profileId || "").startsWith("raincoat_");

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
