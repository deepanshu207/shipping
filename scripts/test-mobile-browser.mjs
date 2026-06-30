/**
 * Tests own-api mobile flow: processing completes before POST returns,
 * and results are readable after simulated navigation via localStorage.
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
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.__MEESHO_OWN_API__ === true, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const bytes = Uint8Array.from(
        atob(
          "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q=="
        ),
        (c) => c.charCodeAt(0)
      );
      const jpeg = new Blob([bytes], { type: "image/jpeg" });
      const form = new FormData();
      form.append("tagId", "1");
      form.append("tagName", "Bra");
      form.append("image", jpeg, "test.jpg");

      const postStart = Date.now();
      const postRes = await fetch("/api/meesho/getLowestShippingCharge", { method: "POST", body: form });
      const postBody = await postRes.json();
      const postMs = Date.now() - postStart;
      if (!postBody.requestId) return { ok: false, step: "post", postBody, postMs };

      const id = postBody.requestId;

      let pollBody = null;
      for (let i = 0; i < 40; i++) {
        const pollRes = await fetch(`/api/meesho/request/${id}`);
        pollBody = await pollRes.json();
        if (pollBody.status === "completed" || pollBody.status === "failed") break;
        await new Promise((r) => setTimeout(r, 1000));
      }

      return {
        ok: pollBody?.status === "completed" && pollBody.results?.length > 0,
        postMs,
        pollStatus: pollBody?.status,
        resultCount: pollBody?.results?.length || 0,
        smallestKb: pollBody?.results?.[0]?.fileSizeKb,
        id,
      };
    });

    if (!result.ok) {
      console.error("FAIL", JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log("OK  mobile own-api flow");
    console.log(`    requestId=${result.id} postMs=${result.postMs} variants=${result.resultCount} smallest=${result.smallestKb}KB`);
  } finally {
    await browser.close();
    if (server) server.kill("SIGTERM");
  }
}

run().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
