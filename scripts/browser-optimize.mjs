/**
 * Server-side image optimization — runs the same own-api.js logic in headless Chromium
 * so collage/auto/lingerie parity matches the browser without tab-throttling.
 */
import { chromium } from "playwright";

const port = Number(process.argv[2] || 8000);
const raw = await new Promise((resolve, reject) => {
  const chunks = [];
  process.stdin.on("data", (c) => chunks.push(c));
  process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
  process.stdin.on("error", reject);
});

const payload = JSON.parse(raw.toString("utf-8"));
const { imageBase64, tagName, frameStyle } = payload;

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
page.setDefaultTimeout(600000);

try {
  await page.goto(`http://127.0.0.1:${port}/optimizer-shell.html`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(() => window.MeeshoProcessor?.optimize, null, { timeout: 120000 });

  const results = await page.evaluate(
    async ({ dataUrl, tag, style }) => {
      return window.MeeshoProcessor.optimize(dataUrl, tag, style);
    },
    {
      dataUrl: imageBase64,
      tag: tagName || "Product",
      style: frameStyle || {},
    }
  );

  process.stdout.write(JSON.stringify(results));
} finally {
  await browser.close();
}
