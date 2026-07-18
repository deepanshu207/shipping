/**
 * Smoke-test a Cloudflare deployment.
 * Usage: node scripts/verify-deploy.mjs https://shipping.example.workers.dev
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
    if (res.ok && text.includes("Meesho Image Generator") && text.includes("Auto Lowest Shipping")) {
      checks.push(["GET /", true, "single-page generator"]);
    } else {
      checks.push(["GET /", false, `status ${res.status}`]);
    }
  } catch (e) {
    checks.push(["GET /", false, e.message]);
  }

  try {
    const { res, text } = await get("/own-api.js");
    if (res.ok && text.includes("__MEESHO_OWN_API__")) {
      checks.push(["GET /own-api.js", true, "browser API"]);
    } else {
      checks.push(["GET /own-api.js", false, `status ${res.status}`]);
    }
  } catch (e) {
    checks.push(["GET /own-api.js", false, e.message]);
  }

  try {
    const { res, text } = await get("/");
    if (res.ok && text.includes("Framed Compress") && text.includes("own-api.js")) {
      checks.push(["GET / embedded UI", true, "Auto + Studio + Framed in single HTML"]);
    } else {
      checks.push(["GET / embedded UI", false, "missing modes or api"]);
    }
  } catch (e) {
    checks.push(["GET / embedded UI", false, e.message]);
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
    const { res, text } = await get("/data/product-types.json");
    if (res.ok) {
      const body = JSON.parse(text);
      const leaves = body.meeshoCategoryArray?.find((g) => g.type === "sub-sub-category")?.data?.length;
      if (leaves >= 13) {
        checks.push(["GET /data/product-types.json", true, `${leaves} compression modes`]);
      } else {
        checks.push(["GET /data/product-types.json", false, `expected 13+ modes, got ${leaves}`]);
      }
    } else {
      checks.push(["GET /data/product-types.json", false, `status ${res.status}`]);
    }
  } catch (e) {
    checks.push(["GET /data/product-types.json", false, e.message]);
  }

  for (const [name, ok, detail] of checks) {
    console.log(`${ok ? "  OK" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  }

  const passed = checks.filter(([, ok]) => ok).length;
  console.log(`\n${passed}/${checks.length} checks passed`);
  process.exit(passed === checks.length ? 0 : 1);
}

run();
