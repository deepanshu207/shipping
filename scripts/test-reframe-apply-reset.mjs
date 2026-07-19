/**
 * Verifies reframe preview/reset/apply helpers preserve anchor meta and re-render.
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
    await page.goto(`${BASE}/?v=121`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoFrameSettings && window.MeeshoReframe, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const FS = window.MeeshoFrameSettings;
      const MR = window.MeeshoReframe;
      const jpeg =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==";

      const loadImg = () =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = jpeg;
        });

      const baseline = {
        borderColor: "#7C3AED",
        stickerTemplate: "limited_time",
        borderWidthPreset: "standard",
        borderWidthAdjust: 100,
        stickerLayout: null,
      };

      const meta = {
        kind: "framed_slab",
        profileId: "framed_low",
        processingPath: "framed_low",
        studioBase: false,
        framedMaxSide: 1024,
        baselineFrameStyle: { ...baseline },
        frameStyle: { ...baseline },
        tier: { slabKb: 48, preserveKb: 48, anchorWidth: 400, anchorHeight: 500 },
      };

      const original = await MR.renderCustomVariant(await loadImg(), meta, "framed", baseline);
      meta.tier.anchorBytes = original.bytes;
      meta.tier.anchorInr = MR.estimateMeeshoInr(original);
      meta.tier.preserveBytes = original.bytes;
      meta.anchorBlob = original.blob;

      const thick = {
        ...baseline,
        borderWidthPreset: "thick",
        borderWidthAdjust: 120,
      };
      const thickVariant = await MR.renderCustomVariant(await loadImg(), meta, "framed", thick);

      const resetVariant = await MR.renderCustomVariant(await loadImg(), meta, "framed", baseline);

      const cloneJson = (v) => JSON.parse(JSON.stringify(v));
      const cloned = cloneJson(meta);

      return {
        originalBytes: original.bytes,
        thickBytes: thickVariant.bytes,
        resetBytes: resetVariant.bytes,
        thickDiffersFromOriginal: thickVariant.bytes !== original.bytes || thickVariant.width !== original.width,
        resetMatchesOriginal: resetVariant.bytes === original.bytes,
        jsonCloneLosesBlobInstance: meta.anchorBlob instanceof Blob && !(cloned.anchorBlob instanceof Blob),
        hasBaseline: !!meta.baselineFrameStyle,
        thickScale: FS.resolveBorderWidthScale(thick),
        standardScale: FS.resolveBorderWidthScale(baseline),
      };
    });

    const ok =
      result.hasBaseline &&
      result.thickDiffersFromOriginal &&
      result.resetMatchesOriginal &&
      result.jsonCloneLosesBlobInstance &&
      result.thickScale > result.standardScale;

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
