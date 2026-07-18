/**
 * Verifies border width preset dropdown + fine-tune slider on generation UI.
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
    await page.goto(`${BASE}/?v=108`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.__MEESHO_OWN_API__ === true, { timeout: 20000 });

    await page.locator("#accordion-border summary").click();
    await page.locator("#border-width-preset").selectOption("thin");
    await page.locator("#border-width-adjust").fill("80");

    const result = await page.evaluate(() => {
      var FS = window.MeeshoFrameSettings;
      var preset = document.getElementById("border-width-preset");
      var adjust = document.getElementById("border-width-adjust");
      var hint = document.getElementById("border-width-hint");
      if (!FS || !preset || !adjust) return null;
      var settings = {
        borderWidthPreset: FS.normalizeBorderWidthPreset(preset.value),
        borderWidthAdjust: FS.normalizeBorderWidthAdjust(adjust.value),
      };
      var scale = FS.resolveBorderWidthScale(settings);
      return {
        settings,
        scale,
        hint: hint ? hint.textContent : "",
        presets: FS.BORDER_WIDTH_PRESETS.map((p) => p.id),
      };
    });

    const thinScale = 0.55 * 0.8;
    const ok =
      result &&
      result.settings.borderWidthPreset === "thin" &&
      result.settings.borderWidthAdjust === 80 &&
      Math.abs(result.scale - thinScale) < 0.001 &&
      result.presets.includes("thin") &&
      /thin border/i.test(result.hint || "");

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
