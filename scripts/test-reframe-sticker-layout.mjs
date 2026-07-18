/**
 * Verifies post-generation sticker layout helpers and visibility options.
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
    await page.goto(`${BASE}/optimizer-shell.html?v=102`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoFrameSettings && window.MeeshoReframe, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const FS = window.MeeshoFrameSettings;
      const MR = window.MeeshoReframe;
      const dual = FS.templateHasDualStickers("supplierden_match");
      const layout = FS.normalizeStickerLayout(
        {
          visibility: "primary",
          primary: { x: 0.2, y: 0.5, text1: "SHIP", text2: "FREE" },
        },
        "supplierden_match"
      );
      const info = FS.getTemplateStickerSlotInfo("mega_sale");

      const jpeg =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==";

      const framed = await MR.renderCustomVariant(
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
          tier: { slabKb: 48, preserveKb: 48 },
          whiteRatio: 0.9,
          frameStyle: {
            borderColor: "#7C3AED",
            stickerTemplate: "supplierden_match",
            stickerLayout: layout,
          },
        },
        "framed",
        {
          borderColor: "#7C3AED",
          stickerTemplate: "supplierden_match",
          stickerLayout: layout,
        }
      );

      return {
        dual,
        visibility: layout.visibility,
        primaryText: layout.primary.text1,
        singleStickerTemplate: !info.dual,
        bytes: framed.bytes,
        kb: MR.kb(framed.bytes),
        width: framed.width,
        height: framed.height,
      };
    });

    const ok =
      result.dual &&
      result.visibility === "primary" &&
      result.primaryText === "SHIP" &&
      result.singleStickerTemplate &&
      result.bytes > 0 &&
      result.width > 0;

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
