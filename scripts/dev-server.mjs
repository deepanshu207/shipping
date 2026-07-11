/**
 * Local dev server — mirrors Cloudflare static + SPA routing.
 * Serves supplierhub.in/ with correct MIME types (.mjs, .wasm) and SPA fallback.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "supplierhub.in");
const PORT = Number(process.env.PORT || 8000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function cleanPath(raw) {
  let path = raw.split("?")[0] || "/";
  if (path.startsWith("/supplierhub.in/")) path = path.slice("/supplierhub.in".length);
  if (path === "/supplierhub.in") path = "/";
  return path;
}

async function resolveFile(path) {
  if (path === "/cdn-cgi/rum") return null;
  const rel = path === "/" ? "index.html" : path.replace(/^\//, "");
  const candidate = join(ROOT, rel);
  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
    if (info.isDirectory()) {
      const index = join(candidate, "index.html");
      await stat(index);
      return index;
    }
  } catch {
    /* fall through to SPA */
  }
  return join(ROOT, "index.html");
}

const server = createServer(async (req, res) => {
  const path = cleanPath(req.url || "/");
  try {
    const file = await resolveFile(path);
    if (!file) {
      res.writeHead(204);
      res.end();
      return;
    }
    const body = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": path.startsWith("/assets/") || path.startsWith("/vendor/") ? "public, max-age=0" : "no-cache",
    });
    res.end(body);
  } catch (err) {
    console.error(`[dev] ${req.method} ${path}`, err.message);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Server error");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is busy. Close the other app or run:  PORT=8001 npm run dev\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log("\n  Meesho Optimizer — local dev");
  console.log(`  Open: http://localhost:${PORT}/meesho-image-generator\n`);
  console.log("  Tip: Do NOT use python -m http.server or Live Server from repo root.");
  console.log("  Use npm run dev (this server) — same SPA routing as Cloudflare deploy.\n");
});
