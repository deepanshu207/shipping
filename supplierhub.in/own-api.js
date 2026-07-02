/**
 * Own API for Meesho Image Generator — runs entirely in the browser.
 */
(function () {
  /** SupplierDen format for every image — orange frame, overlays, slab KB tiers. */
  const TIERS_BUSY_BG = [
    { slabKb: 91, label: "Lowest · may beat ₹93 on Meesho", lowest: true },
    { slabKb: 92, label: "Balanced" },
    { slabKb: 93, label: "Recommended · SupplierDen ₹93 match", recommended: true },
    { slabKb: 94, label: "High detail backup" },
  ];
  const BUSY_MIN_Q = 15;
  const MAX_SIDE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 1200 : 2000;
  const STALE_PROCESSING_MS = 120000;
  const PROCESS_TIMEOUT_MS = 180000;
  const SUPPLIERDEN_ORANGE = "#FF7900";
  const SUPPLIERDEN_BORDER_RATIO = 0.048;
  const SUPPLIERDEN_MIN_BORDER = 34;
  const MEESHO_FRAMED_MAX_SIDE = 1280;

  function blobAtCanvasQuality(canvas, quality, minQuality = 0.28) {
    const q = Math.max(minQuality, Math.min(0.98, quality));
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || new Blob()), "image/jpeg", q));
  }

  function supplierDenBorderPx(w, h) {
    let border = Math.max(SUPPLIERDEN_MIN_BORDER, Math.round(Math.min(w, h) * SUPPLIERDEN_BORDER_RATIO));
    const maxSide = Math.max(w, h);
    if (maxSide + border * 2 > MEESHO_FRAMED_MAX_SIDE) {
      const capped = Math.floor((MEESHO_FRAMED_MAX_SIDE - maxSide) / 2);
      if (capped >= 28) border = capped;
    }
    return border;
  }

  function roundRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawSpecialOfferBadge(ctx, x, y, scale) {
    const w = 92 * scale;
    const h = 54 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.14);
    roundRectPath(ctx, 0, 0, w, h, 7 * scale);
    ctx.fillStyle = "#D32F2F";
    ctx.fill();
    ctx.strokeStyle = "#FFD600";
    ctx.lineWidth = 2.8 * scale;
    ctx.stroke();
    ctx.fillStyle = "#FFD600";
    ctx.font = `900 ${12 * scale}px Arial,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPECIAL", w / 2, h * 0.34);
    ctx.fillText("OFFER", w / 2, h * 0.72);
    ctx.restore();
  }

  function drawHotSaleBurst(ctx, cx, cy, scale) {
    const spikes = 14;
    const outer = 78 * scale;
    const inner = 34 * scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const radius = i % 2 === 0 ? outer : inner;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(0, 0, inner * 0.2, 0, 0, outer);
    grad.addColorStop(0, "#FFEB3B");
    grad.addColorStop(0.55, "#FF9800");
    grad.addColorStop(1, "#E53935");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#B71C1C";
    ctx.lineWidth = 2.2 * scale;
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#7F0000";
    ctx.lineWidth = 1.1 * scale;
    ctx.font = `900 ${15 * scale}px Arial,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("HOT", 0, -14 * scale);
    ctx.fillText("HOT", 0, -14 * scale);
    ctx.font = `900 ${13 * scale}px Arial,sans-serif`;
    ctx.strokeText("SALE", 0, 4 * scale);
    ctx.fillText("SALE", 0, 4 * scale);
    ctx.font = `900 ${11 * scale}px Arial,sans-serif`;
    ctx.strokeText("BIG SALE", 0, 22 * scale);
    ctx.fillText("BIG SALE", 0, 22 * scale);
    ctx.restore();
  }

  function drawSupplierDenOverlays(ctx, border, photoW, photoH) {
    const scale = Math.max(0.72, Math.min(1.35, Math.min(photoW, photoH) / 900));
    drawSpecialOfferBadge(ctx, border + photoW * 0.66, border + photoH * 0.05, scale);
    drawHotSaleBurst(ctx, border + photoW * 0.16, border + photoH * 0.72, scale * 1.05);
  }

  function prepareSupplierDenCanvas(img) {
    let w = img.width;
    let h = img.height;
    const max = Math.max(w, h);
    if (max > MAX_SIDE) {
      const scale = MAX_SIDE / max;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const border = supplierDenBorderPx(w, h);
    const fw = w + border * 2;
    const fh = h + border * 2;
    const c = document.createElement("canvas");
    c.width = fw;
    c.height = fh;
    const ctx = c.getContext("2d");
    ctx.fillStyle = SUPPLIERDEN_ORANGE;
    ctx.fillRect(0, 0, fw, fh);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, img.width, img.height, border, border, w, h);
    drawSupplierDenOverlays(ctx, border, w, h);
    return c;
  }

  async function compressBusyToSlab(canvas, slabKb) {
    const targetBytes = slabKb * 1024;
    const busyMin = BUSY_MIN_Q;
    let best = null;
    let lo = busyMin;
    let hi = 98;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const blob = await blobAtCanvasQuality(canvas, mid / 100, busyMin / 100);
      if (blob.size <= targetBytes) {
        best = blob;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best) return best;
    return blobAtCanvasQuality(canvas, busyMin / 100, busyMin / 100);
  }

  async function buildVariants(canvas) {
    const built = [];
    for (const tier of TIERS_BUSY_BG) {
      const blob = await compressBusyToSlab(canvas, tier.slabKb);
      built.push({
        blob,
        bytes: blob.size,
        label: `${tier.label} · ${canvas.width}×${canvas.height}`,
        recommended: !!tier.recommended,
        lowest: !!tier.lowest,
        processingPath: "supplierden",
        width: canvas.width,
        height: canvas.height,
      });
    }
    return built;
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function loadImageFromUrl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function optimizeToVariants(source) {
    const img = source instanceof File ? await loadImageFromFile(source) : await loadImageFromUrl(source);
    const canvas = prepareSupplierDenCanvas(img);
    return buildVariants(canvas);
  }

  const GUEST_USER = {
    id: "guest-local",
    email: "guest@localhost",
    name: "Local Guest",
    credits: 999,
    role: "USER",
    picture: null,
  };

  const STORE = { requests: new Map(), categories: null };
  const OPT_FLAG = "__meeshoOptimized";
  const SHIM_URL = "http://127.0.0.1/__meesho_own_api__";
  const REQ_PREFIX = "meesho:req:";
  const REQ_INDEX = "meesho:req-index";
  const REQ_LIMIT = 20;
  const origFetch = window.fetch.bind(window);

  function kb(bytes) {
    return Math.max(1, Math.ceil(bytes / 1024));
  }

  function pathOf(url) {
    try {
      return new URL(url, location.origin).pathname;
    } catch {
      return String(url).split("?")[0];
    }
  }

  function isOwnRoute(path) {
    return (
      path === "/api/health" ||
      path === "/auth/me" ||
      path === "/auth/logout" ||
      path === "/api/meesho/fetchCategoryTreeOrder" ||
      path === "/api/meesho/fetchAllRequestId" ||
      path === "/api/meesho/getLowestShippingCharge" ||
      /^\/api\/meesho\/request(?:-status)?\/[^/]+$/.test(path)
    );
  }

  function readIndex() {
    try {
      return JSON.parse(localStorage.getItem(REQ_INDEX) || "[]");
    } catch {
      return [];
    }
  }

  function writeIndex(ids) {
    try {
      localStorage.setItem(REQ_INDEX, JSON.stringify(ids.slice(0, REQ_LIMIT)));
    } catch (e) {
      console.warn("[own-api] index save failed:", e);
    }
  }

  function persistRequest(id, req) {
    const payload = {
      createdAt: req.createdAt,
      tagName: req.tagName,
      status: req.status,
      results: req.results || [],
      error: req.error || null,
    };
    try {
      localStorage.setItem(REQ_PREFIX + id, JSON.stringify(payload));
      const index = readIndex().filter((entry) => entry !== id);
      index.unshift(id);
      writeIndex(index);
    } catch (e) {
      console.warn("[own-api] request save failed:", e);
      try {
        const index = readIndex();
        while (index.length) {
          localStorage.removeItem(REQ_PREFIX + index.pop());
          writeIndex(index);
          localStorage.setItem(REQ_PREFIX + id, JSON.stringify(payload));
          const next = readIndex().filter((entry) => entry !== id);
          next.unshift(id);
          writeIndex(next);
          break;
        }
      } catch {
        /* quota still exceeded */
      }
    }
  }

  function loadRequest(id, fresh) {
    if (!fresh) {
      const cached = STORE.requests.get(id);
      if (cached) return cached;
    }
    try {
      const raw = localStorage.getItem(REQ_PREFIX + id);
      if (!raw) {
        STORE.requests.delete(id);
        return null;
      }
      const req = JSON.parse(raw);
      STORE.requests.set(id, req);
      return req;
    } catch {
      return null;
    }
  }

  function markStaleProcessingFailed(id, req) {
    req.status = "failed";
    req.error = "Processing timed out";
    STORE.requests.set(id, req);
    persistRequest(id, req);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function variantsToResults(variants, tagName) {
    const minBytes = Math.min(...variants.map((v) => v.bytes));
    const out = [];
    for (const v of variants) {
      const imageUrl = await blobToDataUrl(v.blob);
      const fileSizeKb = kb(v.bytes);
      out.push({
        imageUrl,
        tagName: `${v.label} · ${fileSizeKb} KB`,
        fileSizeBytes: v.bytes,
        fileSizeKb,
        shippingCharge: String(fileSizeKb),
        estimatedShippingInr: fileSizeKb,
        shippingEstimate: true,
        processingPath: v.processingPath,
        width: v.width,
        height: v.height,
        lowest: v.bytes === minBytes,
        recommended: v.recommended,
        [OPT_FLAG]: true,
        categoryName: tagName,
      });
    }
    return out;
  }

  async function loadCategories() {
    if (STORE.categories) return STORE.categories;
    const res = await origFetch("/data/meesho-categories.json");
    if (!res.ok) throw new Error("Categories file missing");
    STORE.categories = await res.json();
    return STORE.categories;
  }

  function newRequestId() {
    return Math.random().toString(16).slice(2, 14);
  }

  async function processImage(id, imageFile, tagName) {
    const req = STORE.requests.get(id);
    if (!req) return;
    const work = (async () => {
      req.results = await optimizeToVariants(imageFile, tagName).then((v) => variantsToResults(v, tagName));
      req.status = "completed";
    })();
    try {
      await Promise.race([
        work,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Image processing timeout")), PROCESS_TIMEOUT_MS)
        ),
      ]);
    } catch (e) {
      req.status = "failed";
      req.error = String(e);
      console.error("[own-api] processImage failed:", e);
    } finally {
      persistRequest(id, req);
    }
  }

  function getImageFromBody(body) {
    if (body instanceof FormData) {
      const image = body.get("image");
      if (image && typeof image !== "string") return image;
    }
    return null;
  }

  function getFieldFromBody(body, key) {
    if (body instanceof FormData) {
      const v = body.get(key);
      return v == null ? "" : String(v);
    }
    return "";
  }

  async function handleRoute(method, path, body) {
    if (path === "/api/health" && method === "GET") {
      return {
        status: 200,
        body: { ok: true, api: "own", service: "own-api.js", version: 31, platform: "cloudflare-static" },
      };
    }

    if (path === "/auth/me" && method === "GET") {
      return { status: 200, body: GUEST_USER };
    }

    if (path === "/auth/logout" && method === "POST") {
      return { status: 200, body: { ok: true } };
    }

    if (path === "/api/meesho/fetchCategoryTreeOrder" && method === "GET") {
      return { status: 200, body: await loadCategories() };
    }

    if (path === "/api/meesho/fetchAllRequestId" && method === "GET") {
      const history = readIndex()
        .map((id) => {
          const req = loadRequest(id);
          if (!req) return null;
          return {
            requestId: id,
            status: req.status,
            tagName: req.tagName,
            createdAt: req.createdAt,
            results: req.status === "completed" ? req.results : [],
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.createdAt - a.createdAt);
      return { status: 200, body: { data: history, credits: GUEST_USER.credits } };
    }

    if (path === "/api/meesho/getLowestShippingCharge" && method === "POST") {
      const image = getImageFromBody(body);
      const tagName = getFieldFromBody(body, "tagName") || "Product";
      if (!image) {
        return { status: 400, body: { message: "Image is required" } };
      }

      const id = newRequestId();
      const req = {
        createdAt: Date.now(),
        tagName,
        status: "processing",
        results: [],
      };
      STORE.requests.set(id, req);
      persistRequest(id, req);
      await processImage(id, image, tagName);
      return { status: 200, body: { requestId: id } };
    }

    const poll = path.match(/^\/api\/meesho\/request(?:-status)?\/([^/]+)$/);
    if (poll && method === "GET") {
      const id = poll[1];
      const req = loadRequest(id, true);
      if (!req) return { status: 404, body: { message: "Request not found" } };
      if (req.status === "completed") {
        return { status: 200, body: { status: "completed", results: req.results || [] } };
      }
      if (req.status === "failed") return { status: 200, body: { status: "failed", results: [] } };
      if (Date.now() - req.createdAt > STALE_PROCESSING_MS) {
        markStaleProcessingFailed(id, req);
        return { status: 200, body: { status: "failed", results: [] } };
      }
      return { status: 200, body: { status: "processing", results: [] } };
    }

    return { status: 404, body: { message: "Not found", route: path } };
  }

  function finishXhr(xhr, status, data) {
    const text = JSON.stringify(data);
    const ok = status >= 200 && status < 300;

    Object.defineProperty(xhr, "status", { value: status, configurable: true });
    Object.defineProperty(xhr, "statusText", { value: ok ? "OK" : "Error", configurable: true });
    Object.defineProperty(xhr, "responseText", { value: text, configurable: true });
    Object.defineProperty(xhr, "response", { value: text, configurable: true });
    Object.defineProperty(xhr, "responseURL", { value: SHIM_URL, configurable: true });

    xhr.getResponseHeader = (name) => {
      if (String(name).toLowerCase() === "content-type") return "application/json; charset=utf-8";
      return null;
    };
    xhr.getAllResponseHeaders = () => "content-type: application/json; charset=utf-8\r\n";

    for (const state of [1, 2, 3, 4]) {
      Object.defineProperty(xhr, "readyState", { value: state, configurable: true });
      xhr.dispatchEvent(new Event("readystatechange"));
    }
    xhr.dispatchEvent(new Event(ok ? "load" : "error"));
    xhr.dispatchEvent(new Event("loadend"));
  }

  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const path = pathOf(url);
    if (!isOwnRoute(path)) return origFetch(input, init);
    const method = (init?.method || "GET").toUpperCase();
    const { status, body } = await handleRoute(method, path, init?.body);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };

  const NativeXHR = window.XMLHttpRequest;
  function OwnXHR() {
    const xhr = new NativeXHR();
    let _method = "GET";
    let _path = "";
    let _intercept = false;

    const origOpen = xhr.open.bind(xhr);
    xhr.open = function (method, url, async, user, password) {
      _method = (method || "GET").toUpperCase();
      _path = pathOf(url);
      _intercept = isOwnRoute(_path);
      if (_intercept) {
        return origOpen(method, SHIM_URL, async !== false, user, password);
      }
      return origOpen(method, url, async, user, password);
    };

    const origSend = xhr.send.bind(xhr);
    xhr.send = function (body) {
      if (!_intercept) return origSend(body);
      handleRoute(_method, _path, body)
        .then(({ status, body: data }) => finishXhr(xhr, status, data))
        .catch((err) => {
          console.error("[own-api] XHR route error:", err);
          finishXhr(xhr, 500, { message: err.message || "Error" });
        });
    };

    return xhr;
  }
  OwnXHR.prototype = NativeXHR.prototype;
  window.XMLHttpRequest = OwnXHR;

  window.__MEESHO_OWN_API__ = true;
  console.info("[own-api] browser API with local persistence; deploy via Cloudflare");
})();
