/**
 * Verifies post-generation sticker layout (v2 stickers array), defaults, and reframe render.
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
    await page.goto(`${BASE}/optimizer-shell.html?v=103`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoFrameSettings && window.MeeshoReframe, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const FS = window.MeeshoFrameSettings;
      const MR = window.MeeshoReframe;

      const defaults = FS.defaultStickerLayoutForTemplate("supplierden_match");
      const legacy = FS.normalizeStickerLayout(
        {
          visibility: "primary",
          primary: { x: 0.2, y: 0.5, text1: "SHIP", text2: "FREE" },
        },
        "supplierden_match"
      );
      const custom = FS.normalizeStickerLayout(
        {
          version: 2,
          stickers: [
            { type: "free_delivery", x: 0.15, y: 0.2, text1: "FREE", text2: "SHIP" },
            { type: "special_offer", x: 0.8, y: 0.75, text1: "DEAL", text2: "NOW" },
          ],
        },
        "supplierden_match"
      );
      const empty = FS.normalizeStickerLayout({ version: 2, stickers: [] }, "supplierden_match");
      const added = FS.cloneStickerLayout(custom, "supplierden_match");
      added.stickers.push(FS.newStickerSlot("mega_sale", { x: 0.5, y: 0.5 }));

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
      };

      const framedCustom = await MR.renderCustomVariant(
        await loadImg(),
        meta,
        "framed",
        {
          borderColor: "#7C3AED",
          stickerTemplate: "supplierden_match",
          stickerLayout: custom,
        }
      );

      const framedEmpty = await MR.renderCustomVariant(
        await loadImg(),
        meta,
        "framed",
        {
          borderColor: "#7C3AED",
          stickerTemplate: "supplierden_match",
          stickerLayout: empty,
        }
      );

      return {
        defaultCount: defaults.stickers.length,
        legacyCount: legacy.stickers.length,
        legacyText: legacy.stickers[0]?.text1,
        customCount: custom.stickers.length,
        customText: custom.stickers[0]?.text1,
        emptyCount: empty.stickers.length,
        addedCount: added.stickers.length,
        maxStickers: FS.REFRAME_MAX_STICKERS,
        customBytes: framedCustom.bytes,
        emptyBytes: framedEmpty.bytes,
        customKb: MR.kb(framedCustom.bytes),
      };
    });

    const ok =
      result.defaultCount === 2 &&
      result.legacyCount === 1 &&
      result.legacyText === "SHIP" &&
      result.customCount === 2 &&
      result.customText === "FREE" &&
      result.emptyCount === 0 &&
      result.addedCount === 3 &&
      result.maxStickers === 5 &&
      result.customBytes > 0 &&
      result.emptyBytes > 0;

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
