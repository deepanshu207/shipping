/**
 * Verifies post-generation sticker layout and shipping byte cap on reframe.
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
    await page.goto(`${BASE}/optimizer-shell.html?v=104`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoFrameSettings && window.MeeshoReframe, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const FS = window.MeeshoFrameSettings;
      const MR = window.MeeshoReframe;

      const defaults = FS.defaultStickerLayoutForTemplate("supplierden_match");
      const heavyLayout = FS.normalizeStickerLayout(
        {
          version: 2,
          stickers: [
            { type: "free_delivery", x: 0.15, y: 0.2, text1: "FREE", text2: "SHIP" },
            { type: "special_offer", x: 0.8, y: 0.75, text1: "DEAL", text2: "NOW" },
            { type: "mega_sale", x: 0.5, y: 0.5, text1: "MEGA", text2: "SALE" },
            { type: "hot_sale", x: 0.3, y: 0.8, text1: "HOT", text2: "SALE" },
          ],
        },
        "supplierden_match"
      );

      const jpeg =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==";

      const loadImg = () =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = jpeg;
        });

      const meta = {
        kind: "framed_slab",
        profileId: "framed_low",
        processingPath: "framed_low",
        studioBase: false,
        framedMaxSide: 1024,
        tier: { slabKb: 48, preserveKb: 48 },
        whiteRatio: 0.9,
        baselineFrameStyle: {
          borderColor: "#7C3AED",
          stickerTemplate: "supplierden_match",
          stickerLayout: null,
        },
      };

      const original = await MR.renderCustomVariant(
        await loadImg(),
        meta,
        "framed",
        { borderColor: "#7C3AED", stickerTemplate: "supplierden_match" }
      );

      const anchorBytes = original.bytes;
      const anchorInr = MR.estimateMeeshoInr(original);
      const anchoredMeta = {
        ...meta,
        tier: {
          slabKb: 48,
          preserveKb: 48,
          anchorBytes,
          anchorInr,
          preserveBytes: anchorBytes,
        },
      };

      const reframedHeavy = await MR.renderCustomVariant(
        await loadImg(),
        anchoredMeta,
        "framed",
        {
          borderColor: "#7C3AED",
          stickerTemplate: "supplierden_match",
          stickerLayout: heavyLayout,
        }
      );

      const reframedReset = await MR.renderCustomVariant(
        await loadImg(),
        anchoredMeta,
        "framed",
        { borderColor: "#7C3AED", stickerTemplate: "supplierden_match" }
      );

      return {
        defaultCount: defaults.stickers.length,
        anchorBytes,
        anchorInr,
        heavyBytes: reframedHeavy.bytes,
        heavyInr: MR.estimateMeeshoInr(reframedHeavy),
        resetBytes: reframedReset.bytes,
        resetInr: MR.estimateMeeshoInr(reframedReset),
        heavyWithinCap: reframedHeavy.bytes <= anchorBytes,
        resetWithinCap: reframedReset.bytes <= anchorBytes,
        heavyInrOk: MR.estimateMeeshoInr(reframedHeavy) <= anchorInr,
      };
    });

    const ok =
      result.defaultCount === 2 &&
      result.anchorBytes > 0 &&
      result.heavyWithinCap &&
      result.resetWithinCap &&
      result.heavyInrOk;

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
