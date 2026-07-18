/**
 * Verifies Tall mode sends border + sticker selections from the form to the API.
 */
import { chromium, devices } from "playwright";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";

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
  const tmpJpeg = join(tmpdir(), `meesho-tall-frame-${Date.now()}.jpg`);
  const jpegBytes = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==",
    "base64"
  );
  writeFileSync(tmpJpeg, jpegBytes);

  try {
    await page.goto(`${BASE}/?v=101`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.__MEESHO_OWN_API__ === true, { timeout: 20000 });

    await page.locator(".mode[data-tall50='1']").click();
    await page.locator("#accordion-border summary").click();
    await page.locator("#border-preset").selectOption("meesho_red");
    await page.locator("#accordion-stickers summary").click();
    await page.locator("#sticker-template").selectOption("mega_sale");

    const templateDesc = await page.locator("#template-desc").textContent();
    await page.locator("#file").setInputFiles(tmpJpeg);
    await page.waitForFunction(() => !document.getElementById("generate").disabled, { timeout: 10000 });

    const framePayload = await page.evaluate(() => {
      var borderHex = document.getElementById("border-hex");
      var sticker = document.getElementById("sticker-template");
      var FS = window.MeeshoFrameSettings;
      if (!FS) return null;
      return {
        borderColor: FS.normalizeBorderColor(borderHex.value),
        stickerTemplate: FS.normalizeStickerTemplate(sticker.value),
      };
    });

    const result = {
      ok:
        framePayload &&
        framePayload.stickerTemplate === "mega_sale" &&
        framePayload.borderColor === "#E53935" &&
        /mega sale/i.test(templateDesc || ""),
      framePayload,
      templateDesc,
    };

    if (!result.ok) {
      console.error("FAIL", result);
      process.exit(1);
    }
    console.log("OK", JSON.stringify(result));
  } finally {
    try {
      unlinkSync(tmpJpeg);
    } catch {}
    await browser.close();
    if (server) server.kill("SIGTERM");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
