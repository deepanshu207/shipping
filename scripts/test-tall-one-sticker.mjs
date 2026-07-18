/**
 * Verifies Tall 1 sticker mode uses single FREE DELIVERY overlay only.
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
    await page.goto(`${BASE}/optimizer-shell.html?v=107`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoFrameSettings, { timeout: 20000 });

    const result = await page.evaluate(() => {
      const FS = window.MeeshoFrameSettings;
      const one = FS.defaultStickerLayoutForTemplate("supplierden_one");
      const dual = FS.defaultStickerLayoutForTemplate("supplierden_match");
      const info = FS.getTemplateStickerSlotInfo("supplierden_one");
      return {
        oneCount: one.stickers.length,
        dualCount: dual.stickers.length,
        singleOnly: !info.dual,
        primaryType: one.stickers[0]?.type,
      };
    });

    const ok =
      result.oneCount === 1 &&
      result.dualCount === 2 &&
      result.singleOnly &&
      result.primaryType === "free_delivery";

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
