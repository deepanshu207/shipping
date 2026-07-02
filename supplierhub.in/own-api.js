/**
 * Own API for Meesho Image Generator — runs entirely in the browser.
 */
(function () {
  /** Compression logic from commit 125b98a05351ae284077bc477af05dc44cc7602d */
  const MEESHO_CANVAS_SIZE = 2000;
  const MEESHO_MAX_BYTES = 300 * 1024;
  const MEESHO_VARIANTS = [
    { coverage: 0.62, quality: 82, label: "Tier 1 · Smallest frame (try first)" },
    { coverage: 0.65, quality: 78, label: "Tier 2 · Compact" },
    { coverage: 0.68, quality: 74, label: "Tier 3 · Balanced" },
    { coverage: 0.7, quality: 70, label: "Tier 4 · Standard Meesho size" },
  ];
  const ABS_MIN_Q = 18;
  const MOZJPEG_TIMEOUT_MS = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 90000 : 45000;
  const STALE_PROCESSING_MS = 120000;
  const PROCESS_TIMEOUT_MS = 180000;
  const MOZJPEG_URL = () => new URL("/vendor/mozjpeg.mjs", location.origin).href;

  const MOZ_BASE = {
    baseline: false,
    progressive: true,
    optimize_coding: true,
    quant_table: 2,
    auto_subsample: true,
    chroma_subsample: 2,
    trellis_multipass: true,
    trellis_opt_zero: true,
    trellis_opt_table: true,
    trellis_loops: 3,
    separate_chroma_quality: true,
  };

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
    return Math.max(1, Math.round(bytes / 1024));
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

  let mozEncodeFn = null;
  let mozLoadPromise = null;

  /** Wait for mozjpeg WASM — required for real compression (canvas JPEG ~2× larger). */
  function loadMozjpeg() {
    if (mozEncodeFn) return Promise.resolve(mozEncodeFn);
    if (window.__mozEncodeReady) {
      mozEncodeFn = window.__mozEncodeReady;
      return Promise.resolve(mozEncodeFn);
    }
    if (mozLoadPromise) return mozLoadPromise;

    mozLoadPromise = new Promise((resolve, reject) => {
      const done = (fn) => {
        mozEncodeFn = fn;
        resolve(fn);
      };
      const timeout = setTimeout(() => reject(new Error("mozjpeg load timeout")), MOZJPEG_TIMEOUT_MS);

      window.addEventListener(
        "mozjpeg-ready",
        () => {
          clearTimeout(timeout);
          if (window.__mozEncodeReady) done(window.__mozEncodeReady);
          else reject(new Error("mozjpeg loader empty"));
        },
        { once: true }
      );

      import(/* webpackIgnore: true */ MOZJPEG_URL())
        .then((mod) => {
          clearTimeout(timeout);
          done(mod.encodeImageData);
        })
        .catch((err) => {
          clearTimeout(timeout);
          mozLoadPromise = null;
          reject(err);
        });
    });

    return mozLoadPromise;
  }

  function canvasImageData(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  async function encodeMozjpeg(canvas, quality, whiteRatio, baseline) {
    const q = Math.max(ABS_MIN_Q, Math.min(100, Math.round(quality)));
    const encode = await loadMozjpeg();
    return encode(canvasImageData(canvas), {
      ...MOZ_BASE,
      baseline: !!baseline,
      progressive: !baseline,
      quality: q,
      quant_table: 2,
      trellis_multipass: !baseline,
      separate_chroma_quality: !baseline,
      chroma_quality: Math.max(18, Math.round(q * 0.62)),
    });
  }

  /** 125b98a — product centered on 2000×2000 white canvas at coverage tier. */
  function prepareMeeshoCanvas(img, variant) {
    const canvasSize = MEESHO_CANVAS_SIZE;
    const productSize = Math.round(canvasSize * variant.coverage);
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    const scale = Math.min(productSize / img.width, productSize / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, Math.round((canvasSize - w) / 2), Math.round((canvasSize - h) / 2), w, h);
    return canvas;
  }

  /** 125b98a — mozjpeg encode, reduce q until under 300 KB. */
  async function compressToTargetMoz(canvas, quality) {
    let q = quality;
    let blob = await encodeMozjpeg(canvas, q, 0, false);
    while (blob.size > MEESHO_MAX_BYTES && q > 45) {
      q -= 5;
      blob = await encodeMozjpeg(canvas, q, 0, false);
    }
    return blob;
  }

  async function buildMeeshoVariants(img) {
    const built = [];
    for (const variant of MEESHO_VARIANTS) {
      const canvas = prepareMeeshoCanvas(img, variant);
      const blob = await compressToTargetMoz(canvas, variant.quality);
      built.push({
        blob,
        bytes: blob.size,
        label: variant.label,
        width: MEESHO_CANVAS_SIZE,
        height: MEESHO_CANVAS_SIZE,
      });
    }
    built.sort((a, b) => a.bytes - b.bytes);
    const minBytes = built[0]?.bytes ?? 0;
    return built.map((v) => ({ ...v, lowest: v.bytes === minBytes }));
  }

  async function optimizeToVariants(source) {
    await loadMozjpeg();
    const img = source instanceof File ? await loadImageFromFile(source) : await loadImageFromUrl(source);
    return buildMeeshoVariants(img);
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
        width: v.width,
        height: v.height,
        lowest: v.bytes === minBytes,
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
        body: { ok: true, api: "own", service: "own-api.js", version: 32, platform: "cloudflare-static" },
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
