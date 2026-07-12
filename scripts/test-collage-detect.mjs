/**
 * Synthetic front|back collage — Collage mode must split (many variants, not 1 square).
 */
import { chromium } from "playwright";
import sharp from "sharp";
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

/** Cream 2:1 collage with purple panels left + right (mimics bra front|back). */
async function makeCollageJpeg(width = 1000, height = 500) {
  const w = width;
  const h = height;
  const cream = { r: 245, g: 242, b: 235 };
  const purple = { r: 180, g: 150, b: 210 };
  const pixels = Buffer.alloc(w * h * 3, cream.r);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      pixels[i] = cream.r;
      pixels[i + 1] = cream.g;
      pixels[i + 2] = cream.b;
      const inLeft = x < w / 2 - 2;
      const inRight = x > w / 2 + 2;
      const cx = inLeft ? w * 0.25 : inRight ? w * 0.75 : w / 2;
      const cy = h * 0.45;
      const dx = (x - cx) / (w * 0.16);
      const dy = (y - cy) / (h * 0.34);
      if (inLeft || inRight) {
        if (dx * dx + dy * dy < 1) {
          pixels[i] = purple.r;
          pixels[i + 1] = purple.g;
          pixels[i + 2] = purple.b;
        }
      } else {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
      }
    }
  }
  return sharp(pixels, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
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
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.__MEESHO_OWN_API__ === true, { timeout: 20000 });

    for (const [label, jpeg] of [
      ["1000x500", await makeCollageJpeg(1000, 500)],
      ["350x175", await makeCollageJpeg(350, 175)],
    ]) {
      const result = await page.evaluate(async ({ b64, label }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/jpeg" });
      const form = new FormData();
      form.append("tagId", "mo_lingerie");
      form.append("tagName", "Collage multi-scenario lingerie studio lowest shipping");
      form.append("frameBorderColor", "#7C3AED");
      form.append("frameStickerTemplate", "limited_time");
      form.append("image", blob, "collage-test.jpg");

      const postRes = await fetch("/api/meesho/getLowestShippingCharge", { method: "POST", body: form });
      const postBody = await postRes.json();
      if (!postBody.requestId) return { ok: false, step: "post", postBody };

      const id = postBody.requestId;
      let pollBody = null;
      for (let i = 0; i < 240; i++) {
        const pollRes = await fetch(`/api/meesho/request-status/${id}`);
        pollBody = await pollRes.json();
        if (pollBody.status === "completed" || pollBody.status === "failed") break;
        await new Promise((r) => setTimeout(r, 1000));
      }

      const tags = (pollBody?.results || []).map((r) => r.tagName || "");
      const estimates = (pollBody?.results || []).map((r) => Number(r.estimatedShippingInr || r.shippingCharge || 0));
      const hasFront = tags.some((t) => /front/i.test(t));
      const hasBack = tags.some((t) => /back/i.test(t));
      const backResults = (pollBody?.results || []).filter((r) => /back/i.test(r.tagName || ""));
      const lowestBackEst = backResults.length
        ? Math.min(...backResults.map((r) => Number(r.estimatedShippingInr || r.shippingCharge || 99)))
        : 99;
      const hasSquareOnly = tags.length <= 4 && tags.every((t) => !/front|back/i.test(t));

      return {
        label,
        ok:
          pollBody?.status === "completed" &&
          pollBody.results?.length >= 8 &&
          hasFront &&
          hasBack &&
          lowestBackEst <= 41 &&
          !hasSquareOnly,
        status: pollBody?.status,
        resultCount: pollBody?.results?.length || 0,
        hasFront,
        hasBack,
        lowestBackEst,
        lowestEst: estimates.length ? Math.min(...estimates) : null,
        sampleTags: tags.slice(0, 6),
        message: pollBody?.message,
      };
    }, { b64: jpeg.toString("base64"), label });

      if (!result.ok) {
        console.error("FAIL", label, JSON.stringify(result, null, 2));
        process.exit(1);
      }

      console.log(
        `OK  ${label}: variants=${result.resultCount} front=${result.hasFront} back=${result.hasBack} lowestBack=₹${result.lowestBackEst}`
      );
    }
  } finally {
    await browser.close();
    if (server) server.kill("SIGTERM");
  }
}

run().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
