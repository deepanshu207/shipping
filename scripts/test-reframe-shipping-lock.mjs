/**
 * Post-generation reframe edits (mode, color, template, border width) must keep
 * shipping locked to the generation anchor — same as sticker text/position edits.
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
    await page.goto(`${BASE}/?v=117`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoFrameSettings && window.MeeshoReframe, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const MR = window.MeeshoReframe;
      const FS = window.MeeshoFrameSettings;

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
        stickerTemplate: "supplierden_match",
        borderWidthPreset: "standard",
        borderWidthAdjust: 100,
      };
      const meta0 = {
        kind: "framed_slab",
        profileId: "supplierden_50",
        processingPath: "supplierden_match_50",
        studioBase: false,
        framedMaxSide: 1024,
        baselineFrameStyle: { ...baseline, stickerLayout: null },
        frameStyle: { ...baseline },
        tier: { slabKb: 48, preserveKb: 48 },
      };

      const gen = await MR.renderCustomVariant(await loadImg(), meta0, "framed", baseline);
      const anchorInr = MR.estimateMeeshoInr(gen);
      const anchored = {
        ...meta0,
        tier: {
          slabKb: 48,
          preserveKb: 48,
          anchorBytes: gen.bytes,
          anchorInr,
          anchorWidth: gen.width,
          anchorHeight: gen.height,
          preserveBytes: gen.bytes,
        },
      };

      async function lockedInr(label, mode, style) {
        const v = await MR.renderCustomVariant(await loadImg(), anchored, mode, style);
        const raw = MR.estimateMeeshoInr({
          bytes: v.bytes,
          width: gen.width,
          height: gen.height,
          processingPath: anchored.processingPath,
          profileId: anchored.profileId,
        });
        const locked = MR.estimateReframeShippingInr(v, anchored);
        return {
          label,
          raw,
          locked,
          anchorInr,
          shippingLocked: locked <= anchorInr,
          bytesWithinCap: v.bytes <= gen.bytes,
        };
      }

      const heavyLayout = FS.normalizeStickerLayout(
        FS.defaultStickerLayoutForTemplate("supplierden_match"),
        "supplierden_match"
      );
      heavyLayout.stickers.forEach((s, i) => {
        s.text1 = "EXTRA LONG TEXT " + i;
        s.text2 = "LINE TWO " + i;
      });

      const tightAnchored = {
        ...anchored,
        tier: {
          ...anchored.tier,
          anchorBytes: Math.floor(gen.bytes * 0.55),
          preserveBytes: Math.floor(gen.bytes * 0.55),
        },
      };

      async function lockedInrTight(label, mode, style) {
        const v = await MR.renderCustomVariant(await loadImg(), tightAnchored, mode, style);
        const raw = MR.estimateMeeshoInr({
          bytes: v.bytes,
          width: gen.width,
          height: gen.height,
          processingPath: anchored.processingPath,
          profileId: anchored.profileId,
        });
        const locked = MR.estimateReframeShippingInr(v, tightAnchored);
        return {
          label,
          raw,
          locked,
          anchorInr,
          shippingLocked: locked <= anchorInr,
        };
      }

      return {
        anchorInr,
        color: await lockedInr("color", "framed", { ...baseline, borderColor: "#00FF00" }),
        template: await lockedInr("template", "framed", { ...baseline, stickerTemplate: "mega_sale" }),
        frameOnly: await lockedInr("frameOnly", "frame_only", { ...baseline, stickerTemplate: "none" }),
        studio: await lockedInr("studio", "studio", baseline),
        thick: await lockedInr("thick", "framed", {
          ...baseline,
          borderWidthPreset: "thick",
          borderWidthAdjust: 150,
        }),
        textPos: await lockedInr("textPos", "framed", { ...baseline, stickerLayout: heavyLayout }),
        tightColor: await lockedInrTight("tightColor", "framed", { ...baseline, borderColor: "#FF5500" }),
        tightTemplate: await lockedInrTight("tightTemplate", "framed", {
          ...baseline,
          stickerTemplate: "limited_time",
        }),
      };
    });

    const checks = [
      result.color,
      result.template,
      result.frameOnly,
      result.studio,
      result.thick,
      result.textPos,
      result.tightColor,
      result.tightTemplate,
    ];
    const ok = checks.every((c) => c.shippingLocked);

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
