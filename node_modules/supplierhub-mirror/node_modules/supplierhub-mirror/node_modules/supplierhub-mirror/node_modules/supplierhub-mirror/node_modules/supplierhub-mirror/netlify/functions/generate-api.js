import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { generateAllVariants } from "./image-optimize.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATEGORIES_PATH = join(__dirname, "../../supplierhub.in/data/meesho-categories.json");

const GUEST_USER = {
  id: "guest-local",
  email: "guest@localhost",
  name: "Local Guest",
  credits: 999,
  role: "USER",
  picture: null,
};

let categoriesCache = null;

function getCategories() {
  if (!categoriesCache) {
    categoriesCache = JSON.parse(readFileSync(CATEGORIES_PATH, "utf8"));
  }
  return categoriesCache;
}

function getStore() {
  if (!globalThis.__meeshoRequests) {
    globalThis.__meeshoRequests = new Map();
  }
  return globalThis.__meeshoRequests;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

async function processRequest(requestId) {
  const store = getStore();
  const req = store.get(requestId);
  if (!req || req.status === "completed" || req.processing) return;

  req.processing = true;
  try {
    req.results = await generateAllVariants(req.imageBuffer, req.tagName);
    req.status = "completed";
    req.imageBuffer = null;
  } catch (error) {
    req.status = "failed";
    req.error = error.message;
  } finally {
    req.processing = false;
  }
}

function resolveRoute(request) {
  const url = new URL(request.url);
  const fnPrefix = "/.netlify/functions/generate-api";

  if (url.pathname.startsWith(fnPrefix)) {
    const rest = url.pathname.slice(fnPrefix.length) || "/";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }

  for (const header of ["x-nf-rewrite-path", "x-forwarded-uri", "x-original-url"]) {
    const value = request.headers.get(header);
    if (value) {
      const path = value.split("?")[0];
      if (path.startsWith("/api/") || path.startsWith("/auth/")) return path;
    }
  }

  return url.pathname;
}

export default async (request, context) => {
  try {
    const route = resolveRoute(request);
    const method = request.method;

    if (route === "/auth/me" && method === "GET") {
      return json(GUEST_USER);
    }

    if (route === "/auth/logout" && method === "POST") {
      return json({ ok: true });
    }

    if (route === "/api/meesho/fetchCategoryTreeOrder" && method === "GET") {
      return json(getCategories());
    }

    const store = getStore();

    if (route === "/api/meesho/getLowestShippingCharge" && method === "POST") {
      const form = await request.formData();
      const image = form.get("image");
      const tagName = form.get("tagName")?.toString() || "Product";

      if (!image || typeof image === "string") {
        return json({ message: "Image is required" }, 400);
      }

      const imageBuffer = Buffer.from(await image.arrayBuffer());
      if (!imageBuffer.length) {
        return json({ message: "Image is required" }, 400);
      }

      const requestId = randomBytes(6).toString("hex");
      store.set(requestId, {
        createdAt: Date.now(),
        tagName,
        tagId: form.get("tagId")?.toString() || "",
        imageBuffer,
        status: "processing",
        results: [],
        processing: false,
      });

      if (context?.waitUntil) {
        context.waitUntil(processRequest(requestId));
      } else {
        await processRequest(requestId);
      }

      return json({ requestId });
    }

    if (route === "/api/meesho/fetchAllRequestId" && method === "GET") {
      const history = [];
      for (const [requestId, req] of store.entries()) {
        const done = req.status === "completed";
        history.push({
          requestId,
          status: done ? "completed" : req.status === "failed" ? "failed" : "processing",
          tagName: req.tagName,
          createdAt: req.createdAt,
          results: done ? req.results : [],
        });
      }
      history.sort((a, b) => b.createdAt - a.createdAt);
      return json({ data: history, credits: GUEST_USER.credits });
    }

    const requestMatch = route.match(/^\/api\/meesho\/request(?:-status)?\/([^/]+)$/);
    if (requestMatch && method === "GET") {
      const requestId = requestMatch[1];
      const req = store.get(requestId);

      if (!req) {
        return json({ message: "Request not found" }, 404);
      }

      if (req.status !== "completed" && !req.processing) {
        await processRequest(requestId);
      }

      if (req.status === "failed") {
        return json({ status: "failed", results: [] });
      }

      if (Date.now() - req.createdAt < 3000 || req.status !== "completed") {
        return json({ status: "processing", results: [] });
      }

      return json({ status: "completed", results: req.results || [] });
    }

    return json({ message: "Not found", route, method }, 404);
  } catch (error) {
    console.error("generate-api error:", error);
    return json({ message: error.message || "Internal error" }, 500);
  }
};
