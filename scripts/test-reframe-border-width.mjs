/**
 * Border width controls exist only in reframe editor (post-generation), not on generate form.
 */
import { chromium, devices } from "playwright";
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
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/?v=121`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.__MEESHO_OWN_API__ === true, { timeout: 20000 });

    const result = await page.evaluate(() => {
      var FS = window.MeeshoFrameSettings;
      var MR = window.MeeshoReframe;
      var genPreset = document.getElementById("border-width-preset");
      var reframePreset = document.getElementById("reframe-border-width-preset");
      var reframeAdjust = document.getElementById("reframe-border-width-adjust");
      if (!FS || !MR || !reframePreset || !reframeAdjust) return null;
      reframePreset.value = "thick";
      reframeAdjust.value = "120";
      reframeAdjust.dispatchEvent(new Event("input", { bubbles: true }));
      var scale = FS.resolveBorderWidthScale({
        borderWidthPreset: FS.normalizeBorderWidthPreset(reframePreset.value),
        borderWidthAdjust: FS.normalizeBorderWidthAdjust(reframeAdjust.value),
      });
      var meta = {
        processingPath: "supplierden_match_50",
        profileId: "supplierden_50",
        tier: { anchorBytes: 45056, anchorInr: 50, anchorWidth: 703, anchorHeight: 1024 },
      };
      var variant = {
        bytes: 52000,
        width: 1280,
        height: 1100,
        processingPath: "supplierden_match_50",
        profileId: "supplierden_50",
      };
      var rawInr = MR.estimateMeeshoInr(variant);
      var lockedInr = MR.estimateReframeShippingInr(variant, meta);
      return {
        generationControlMissing: !genPreset,
        reframePreset: FS.normalizeBorderWidthPreset(reframePreset.value),
        reframeAdjust: FS.normalizeBorderWidthAdjust(reframeAdjust.value),
        scale,
        presets: FS.BORDER_WIDTH_PRESETS.map((p) => p.id),
        rawInr,
        lockedInr,
        shippingLocked: lockedInr <= 50 && rawInr > lockedInr,
      };
    });

    const expectedScale = 1.35 * 1.2;
    const ok =
      result &&
      result.generationControlMissing &&
      result.reframePreset === "thick" &&
      result.reframeAdjust === 120 &&
      Math.abs(result.scale - expectedScale) < 0.001 &&
      result.presets.includes("thin") &&
      result.shippingLocked;

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
