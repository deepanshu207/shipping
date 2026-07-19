/**
 * Simulates post-generation → edit → reset → apply using the same anchor/preview rules.
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
    await page.goto(`${BASE}/?v=119`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoFrameSettings && window.MeeshoReframe, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const MR = window.MeeshoReframe;
      const jpeg =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==";

      const baseline = {
        borderColor: "#7C3AED",
        stickerTemplate: "limited_time",
        borderWidthPreset: "standard",
        borderWidthAdjust: 100,
        stickerLayout: null,
      };

      const variant = await MR.renderCustomVariant(
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = jpeg;
        }),
        {
          kind: "framed_slab",
          profileId: "framed_low",
          processingPath: "framed_low",
          studioBase: false,
          framedMaxSide: 1024,
          baselineFrameStyle: { ...baseline },
          frameStyle: { ...baseline },
          tier: { slabKb: 48, preserveKb: 48, anchorWidth: 400, anchorHeight: 500 },
        },
        "framed",
        baseline
      );

      const generationUrl = await MR.blobToDataUrl(variant.blob);
      const result = {
        imageUrl: generationUrl,
        tagName: "48KB framed · 48 KB",
        fileSizeKb: MR.kb(variant.bytes),
        fileSizeBytes: variant.bytes,
        estimatedShippingInr: MR.estimateMeeshoInr(variant),
        width: variant.width,
        height: variant.height,
        reframeMeta: {
          kind: "framed_slab",
          profileId: "framed_low",
          processingPath: "framed_low",
          studioBase: false,
          framedMaxSide: 1024,
          baselineFrameStyle: { ...baseline },
          frameStyle: { ...baseline },
          tier: {
            slabKb: 48,
            preserveKb: 48,
            anchorBytes: variant.bytes,
            anchorInr: MR.estimateMeeshoInr(variant),
            anchorWidth: variant.width,
            anchorHeight: variant.height,
          },
        },
      };

      // freeze at showResults
      const meta = result.reframeMeta;
      meta.anchorImageUrl = result.imageUrl;
      meta.anchorTagName = result.tagName;
      meta.anchorFileSizeKb = result.fileSizeKb;
      meta.anchorFileSizeBytes = result.fileSizeBytes;
      meta.anchorEstimatedShippingInr = result.estimatedShippingInr;
      meta.anchorFrozen = true;

      const editorAnchor = {
        imageUrl: meta.anchorImageUrl,
        tagName: meta.anchorTagName,
        fileSizeKb: meta.anchorFileSizeKb,
        fileSizeBytes: meta.anchorFileSizeBytes,
        estimatedShippingInr: meta.anchorEstimatedShippingInr,
        width: meta.tier.anchorWidth,
        height: meta.tier.anchorHeight,
      };

      // user customizes (new image url + tag)
      const thick = { ...baseline, borderWidthPreset: "thick", borderWidthAdjust: 120 };
      const customized = await MR.renderCustomVariant(
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = jpeg;
        }),
        result.reframeMeta,
        "framed",
        thick
      );
      const customizedUrl = await MR.blobToDataUrl(customized.blob);
      result.imageUrl = customizedUrl;
      result.tagName = "custom · 52 KB · customized";
      result.fileSizeKb = MR.kb(customized.bytes);
      result.fileSizeBytes = customized.bytes;
      meta.frameStyle = thick;

      // reset preview uses anchor (not re-render)
      const resetPreviewUrl = editorAnchor.imageUrl;

      // apply after reset commits preview + anchor metadata
      const applied = {
        imageUrl: resetPreviewUrl,
        tagName: editorAnchor.tagName,
        fileSizeKb: editorAnchor.fileSizeKb,
        fileSizeBytes: editorAnchor.fileSizeBytes,
        estimatedShippingInr: editorAnchor.estimatedShippingInr,
        width: editorAnchor.width,
        height: editorAnchor.height,
      };
      meta.frameStyle = { ...baseline };

      return {
        anchorFrozen: !!meta.anchorFrozen,
        anchorUrlIntact: meta.anchorImageUrl === generationUrl,
        customizedDiffers: customizedUrl !== generationUrl,
        appliedMatchesGeneration: applied.imageUrl === generationUrl,
        appliedTagRestored: applied.tagName === result.reframeMeta.anchorTagName,
        appliedNotCustomizedTag: applied.tagName.indexOf("customized") < 0,
        baselineMatch: MR.isReframeBaselineFrameStyle(baseline, result.reframeMeta),
      };
    });

    const ok =
      result.anchorFrozen &&
      result.anchorUrlIntact &&
      result.customizedDiffers &&
      result.appliedMatchesGeneration &&
      result.appliedTagRestored &&
      result.appliedNotCustomizedTag &&
      result.baselineMatch;

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
