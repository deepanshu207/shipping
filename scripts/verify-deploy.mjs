/**
 * Smoke-test a Cloudflare deployment.
 * Usage: node scripts/verify-deploy.mjs https://myshippings.pages.dev
 */
const BASE = (process.argv[2] || process.env.DEPLOY_URL || "").replace(/\/$/, "");

if (!BASE) {
  console.error("Usage: node scripts/verify-deploy.mjs <base-url>");
  process.exit(1);
}

const checks = [];

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  return { res, text };
}

async function run() {
  console.log(`Deploy verification @ ${BASE}\n`);

  try {
    const { res, text } = await get("/");
    if (res.ok && text.includes("Meesho Optimizer")) {
      checks.push(["GET /", true, "home page"]);
    } else {
      checks.push(["GET /", false, `status ${res.status}`]);
    }
  } catch (e) {
    checks.push(["GET /", false, e.message]);
  }

  try {
    const { res, text } = await get("/own-api.js");
    if (res.ok && text.includes("__MEESHO_OWN_API__")) {
      checks.push(["GET /own-api.js", true, "browser API shim"]);
    } else {
      checks.push(["GET /own-api.js", false, `status ${res.status}`]);
    }
  } catch (e) {
    checks.push(["GET /own-api.js", false, e.message]);
  }

  try {
    const { res, text } = await get("/vendor/mozjpeg.mjs");
    if (res.ok && text.includes("encodeImageData")) {
      checks.push(["GET /vendor/mozjpeg.mjs", true, "mozjpeg module"]);
    } else {
      checks.push(["GET /vendor/mozjpeg.mjs", false, `status ${res.status}`]);
    }
  } catch (e) {
    checks.push(["GET /vendor/mozjpeg.mjs", false, e.message]);
  }

  try {
    const { res } = await get("/meesho-image-generator");
    if (res.ok) {
      checks.push(["GET /meesho-image-generator", true, "SPA route"]);
    } else {
      checks.push(["GET /meesho-image-generator", false, `status ${res.status}`]);
    }
  } catch (e) {
    checks.push(["GET /meesho-image-generator", false, e.message]);
  }

  try {
    const { res, text } = await get("/data/meesho-categories.json");
    if (res.ok) {
      const body = JSON.parse(text);
      if (body.meeshoCategoryArray?.length) {
        checks.push(["GET /data/meesho-categories.json", true, `${body.meeshoCategoryArray.length} groups`]);
      } else {
        checks.push(["GET /data/meesho-categories.json", false, "empty categories"]);
      }
    } else {
      checks.push(["GET /data/meesho-categories.json", false, `status ${res.status}`]);
    }
  } catch (e) {
    checks.push(["GET /data/meesho-categories.json", false, e.message]);
  }

  for (const [name, ok, detail] of checks) {
    console.log(`${ok ? "  OK" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  }

  const passed = checks.filter(([, ok]) => ok).length;
  console.log(`\n${passed}/${checks.length} checks passed`);
  process.exit(passed === checks.length ? 0 : 1);
}

run();
