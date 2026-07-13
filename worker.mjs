/**
 * Cloudflare Worker — static assets + optional API proxy to a Node processor.
 * Set PROCESSOR_URL (e.g. https://your-railway-app.up.railway.app) for server-side image work.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const processor = (env.PROCESSOR_URL || "").trim();

    if (url.pathname === "/processor-config.js") {
      const origin = processor.replace(/\/$/, "");
      const body = `window.__MEESHO_PROCESSOR_ORIGIN__=${JSON.stringify(origin)};`;
      return new Response(body, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    if (url.pathname === "/api/health" && !processor) {
      return new Response(
        JSON.stringify({
          ok: true,
          api: "own",
          service: "cloudflare-worker",
          processing: "client",
          version: 95,
        }),
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    if (processor && (url.pathname.startsWith("/api/meesho/") || url.pathname === "/api/health")) {
      const target = new URL(url.pathname + url.search, processor.replace(/\/$/, ""));
      const headers = new Headers(request.headers);
      headers.delete("host");
      return fetch(
        new Request(target.toString(), {
          method: request.method,
          headers,
          body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
          redirect: "follow",
        })
      );
    }

    return env.ASSETS.fetch(request);
  },
};
