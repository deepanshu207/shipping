/**
 * Built-in sticker types must share the same compact layout/compression profile as FREE DELIVERY
 * so generation and reframe shipping estimates stay consistent across icon choices.
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
    await page.goto(`${BASE}/?v=128`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoFrameSettings && window.MeeshoReframe, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const FS = window.MeeshoFrameSettings;
      const MR = window.MeeshoReframe;
      const types = FS.STICKER_ASSET_TYPES.map((t) => t.id);

      const c = document.createElement("canvas");
      c.width = 900;
      c.height = 1400;
      const ctx = c.getContext("2d");
      for (let y = 0; y < 1400; y += 2) {
        for (let x = 0; x < 900; x += 2) {
          ctx.fillStyle = "rgb(" + (x % 255) + "," + (y % 255) + "," + ((x * y) % 255) + ")";
          ctx.fillRect(x, y, 2, 2);
        }
      }
      const jpeg = c.toDataURL("image/jpeg", 0.95);
      const loadImg = () =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = jpeg;
        });

      const baseline = {
        borderColor: "#7C3AED",
        stickerTemplate: "supplierden_one",
        borderWidthPreset: "standard",
        borderWidthAdjust: 100,
      };
      const meta = {
        kind: "framed_slab",
        profileId: "supplierden_50",
        processingPath: "supplierden_match_50",
        studioBase: false,
        framedMaxSide: 1024,
        baselineFrameStyle: { ...baseline, stickerLayout: null },
        frameStyle: { ...baseline },
        tier: { slabKb: 48, preserveKb: 48 },
      };

      async function renderWithType(typeId) {
        const layout = FS.normalizeStickerLayout(
          {
            version: 2,
            stickers: [{ type: typeId, x: 0.12, y: 0.42, text1: "", text2: "" }],
          },
          "supplierden_one"
        );
        const v = await MR.renderCustomVariant(await loadImg(), meta, "framed", {
          ...baseline,
          stickerLayout: layout,
        });
        return {
          type: typeId,
          bytes: v.bytes,
          inr: MR.estimateMeeshoInr(v),
          width: v.width,
          height: v.height,
        };
      }

      const freeDelivery = await renderWithType("free_delivery");
      const byType = {};
      for (const typeId of types) {
        byType[typeId] = await renderWithType(typeId);
      }

      const byteSpread = Math.max(...types.map((t) => byType[t].bytes)) - freeDelivery.bytes;
      const inrSpread = Math.max(...types.map((t) => byType[t].inr)) - freeDelivery.inr;

      return {
        freeDelivery,
        byType,
        byteSpread,
        inrSpread,
        bytesWithin2kb: byteSpread <= 2048,
        inrWithin1: inrSpread <= 1,
      };
    });

    const ok =
      result.bytesWithin2kb &&
      result.inrWithin1 &&
      result.freeDelivery.bytes > 0;

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
