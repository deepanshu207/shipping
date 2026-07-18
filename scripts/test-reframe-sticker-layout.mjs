/**
 * Verifies reframe sticker edits keep shipping stable (no double-frame, byte cap).
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
    await page.goto(`${BASE}/optimizer-shell.html?v=105`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoFrameSettings && window.MeeshoReframe, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const FS = window.MeeshoFrameSettings;
      const MR = window.MeeshoReframe;

      const defaults = FS.defaultStickerLayoutForTemplate("supplierden_match");
      const tweaked = FS.cloneStickerLayout(defaults, "supplierden_match");
      tweaked.stickers[0].x = Math.min(0.95, tweaked.stickers[0].x + 0.12);
      tweaked.stickers[0].text1 = "FREE";
      tweaked.stickers[0].text2 = "SHIP";

      const heavyLayout = FS.normalizeStickerLayout(
        {
          version: 2,
          stickers: [
            { type: "free_delivery", x: 0.15, y: 0.2, text1: "FREE", text2: "SHIP" },
            { type: "special_offer", x: 0.8, y: 0.75, text1: "DEAL", text2: "NOW" },
            { type: "mega_sale", x: 0.5, y: 0.5, text1: "MEGA", text2: "SALE" },
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

      const frame = { borderColor: "#7C3AED", stickerTemplate: "supplierden_match" };
      const img = await loadImg();

      const original = await MR.renderCustomVariant(img, meta, "framed", frame);
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

      const tweakedVariant = await MR.renderCustomVariant(img, anchoredMeta, "framed", {
        ...frame,
        stickerLayout: tweaked,
      });

      const revertedVariant = await MR.renderCustomVariant(img, anchoredMeta, "framed", frame);

      const heavyVariant = await MR.renderCustomVariant(img, anchoredMeta, "framed", {
        ...frame,
        stickerLayout: heavyLayout,
      });

      const defaultsMatch = FS.isDefaultStickerLayoutForTemplate(
        defaults.stickers,
        "supplierden_match"
      );
      const tweakedMatch = FS.isDefaultStickerLayoutForTemplate(
        tweaked.stickers,
        "supplierden_match"
      );

      return {
        defaultsMatch,
        tweakedMatch,
        anchorBytes,
        anchorInr,
        originalW: original.width,
        originalH: original.height,
        tweakedW: tweakedVariant.width,
        tweakedH: tweakedVariant.height,
        tweakedBytes: tweakedVariant.bytes,
        tweakedInr: MR.estimateReframeShippingInr(tweakedVariant, anchoredMeta),
        revertedBytes: revertedVariant.bytes,
        revertedInr: MR.estimateReframeShippingInr(revertedVariant, anchoredMeta),
        heavyBytes: heavyVariant.bytes,
        heavyInr: MR.estimateReframeShippingInr(heavyVariant, anchoredMeta),
        sameDimensions: tweakedVariant.width === original.width && tweakedVariant.height === original.height,
        tweakedWithinCap: tweakedVariant.bytes <= anchorBytes,
        revertedWithinCap: revertedVariant.bytes <= anchorBytes,
        heavyWithinCap: heavyVariant.bytes <= anchorBytes,
        inrStable:
          MR.estimateReframeShippingInr(tweakedVariant, anchoredMeta) <= anchorInr &&
          MR.estimateReframeShippingInr(revertedVariant, anchoredMeta) <= anchorInr &&
          MR.estimateReframeShippingInr(heavyVariant, anchoredMeta) <= anchorInr,
      };
    });

    const ok =
      result.defaultsMatch &&
      !result.tweakedMatch &&
      result.sameDimensions &&
      result.tweakedWithinCap &&
      result.revertedWithinCap &&
      result.heavyWithinCap &&
      result.inrStable;

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
