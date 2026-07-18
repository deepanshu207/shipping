/**
 * Verifies processing screen exposes Stop and returns to the home form.
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
  const tmpJpeg = join(tmpdir(), `meesho-cancel-${Date.now()}.jpg`);
  const jpegBytes = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==",
    "base64"
  );
  writeFileSync(tmpJpeg, jpegBytes);

  try {
    await page.goto(`${BASE}/?v=100`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.__MEESHO_OWN_API__ === true, { timeout: 20000 });

    await page.locator(".mode[data-tall50='1']").click();
    await page.locator("#file").setInputFiles(tmpJpeg);
    await page.waitForFunction(() => !document.getElementById("generate").disabled, { timeout: 10000 });

    let cancelRequested = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/meesho/cancel-request/")) {
        cancelRequested = true;
      }
    });

    await page.locator("#generate").click();
    await page.waitForSelector("#panel-processing:not(.hidden)", { timeout: 15000 });
    await page.locator("#btn-stop-processing").click({ timeout: 5000 });
    await page.waitForSelector("#panel-form:not(.hidden)", { timeout: 5000 });
    await page.waitForSelector("#panel-processing", { state: "hidden", timeout: 5000 });

    const uiState = await page.evaluate(() => ({
      errorText: document.getElementById("error")?.textContent || "",
      resultsHidden: document.getElementById("panel-results").classList.contains("hidden"),
      stopLabel: document.getElementById("btn-stop-processing")?.textContent || "",
      activeJob: localStorage.getItem("meesho:activeJob"),
    }));

    const result = {
      ok:
        /stop/i.test(uiState.stopLabel) &&
        uiState.errorText === "" &&
        uiState.resultsHidden &&
        uiState.activeJob === null &&
        cancelRequested,
      cancelRequested,
      uiState,
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
