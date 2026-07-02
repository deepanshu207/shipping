/**
 * Own API for Meesho Image Generator — runs entirely in the browser.
 */
(function () {
  /** KB targets — lower when background is mostly white (compresses cleanly). */
  const TIERS_BUSY_BG = [
    { targetKb: 88, label: "Lowest · upload to Meesho first", lowest: true },
    { targetKb: 90, label: "Recommended · balanced", recommended: true },
    { targetKb: 92, label: "Standard" },
    { targetKb: 93, label: "High detail" },
  ];
  /** Meesho charges by square 1:1 images — SupplierDen reframes busy photos on white canvas. */
  const SQUARE_VARIANTS_BUSY = [
    { canvas: 1000, coverage: 0.62, targetKb: 88, label: "Lowest · upload to Meesho first", lowest: true },
    { canvas: 1000, coverage: 0.65, targetKb: 90, label: "Recommended · balanced", recommended: true },
    { canvas: 1000, coverage: 0.58, targetKb: 92, label: "Standard" },
    { canvas: 1000, coverage: 0.62, targetKb: 93, label: "High detail" },
  ];
  const TIERS_WHITE_BG = [
    { targetKb: 20, label: "Lowest · upload to Meesho first", lowest: true },
    { targetKb: 22, label: "Recommended · balanced", recommended: true },
    { targetKb: 24, label: "Standard" },
    { targetKb: 26, label: "High detail" },
  ];

  const WHITE_TOL = 42;
  const WHITE_BG_THRESHOLD = 0.62;
  const ABS_MIN_Q = 18;
  const MAX_SIDE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 1200 : 2000;
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

  function tiersForWhite(whiteRatio) {
    return whiteRatio >= WHITE_BG_THRESHOLD ? TIERS_WHITE_BG : TIERS_BUSY_BG;
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

  async function encodeAtQuality(canvas, quality, floor, whiteRatio) {
    const minQ = floor ?? adaptiveMinQ(whiteRatio ?? 0);
    const q = Math.max(minQ, Math.min(100, Math.round(quality)));
    const encode = await loadMozjpeg();
    const opts = {
      ...MOZ_BASE,
      quality: q,
      quant_table: (whiteRatio ?? 0) >= WHITE_BG_THRESHOLD ? 3 : 2,
      chroma_quality: Math.max(
        18,
        Math.round(
          q *
            ((whiteRatio ?? 0) >= WHITE_BG_THRESHOLD ? 0.5 : (whiteRatio ?? 0) >= 0.4 ? 0.55 : 0.62)
        )
      ),
    };
    return encode(canvasImageData(canvas), opts);
  }

  function measureNearWhiteRatio(canvas) {
    const { data } = canvas.getContext("2d", { willReadFrequently: true }).getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
    let near = 0;
    const total = canvas.width * canvas.height;
    for (let i = 0; i < data.length; i += 4) {
      if (nearWhiteAt(data, i)) near++;
    }
    return near / total;
  }

  function measureWhiteRatio(canvas) {
    const { data } = canvas.getContext("2d", { willReadFrequently: true }).getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
    let white = 0;
    const total = canvas.width * canvas.height;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) white++;
    }
    return white / total;
  }

  /** White-bg photos tolerate lower q — background stays pure white. */
  function adaptiveMinQ(whiteRatio) {
    if (whiteRatio >= 0.78) return 24;
    if (whiteRatio >= 0.68) return 26;
    if (whiteRatio >= 0.55) return 30;
    if (whiteRatio >= 0.40) return 28;
    return 26;
  }

  function adaptiveAbsMinQ(whiteRatio) {
    if (whiteRatio >= 0.72) return 20;
    if (whiteRatio >= 0.58) return 22;
    return ABS_MIN_Q;
  }

  function nearWhiteAt(d, i) {
    return 255 - d[i] <= WHITE_TOL && 255 - d[i + 1] <= WHITE_TOL && 255 - d[i + 2] <= WHITE_TOL;
  }

  /** Flood-fill edge-connected near-white background to pure #FFF — product pixels untouched. */
  function flattenBackgroundWhite(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = canvas;
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    const total = width * height;
    const seen = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    function push(idx) {
      if (seen[idx] || !nearWhiteAt(d, idx * 4)) return;
      seen[idx] = 1;
      queue[tail++] = idx;
    }

    for (let x = 0; x < width; x++) {
      push(x);
      push((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      push(y * width);
      push(y * width + width - 1);
    }

    while (head < tail) {
      const idx = queue[head++];
      const o = idx * 4;
      d[o] = 255;
      d[o + 1] = 255;
      d[o + 2] = 255;
      const x = idx % width;
      const y = (idx / width) | 0;
      if (x > 0) push(idx - 1);
      if (x < width - 1) push(idx + 1);
      if (y > 0) push(idx - width);
      if (y < height - 1) push(idx + width);
    }

    for (let idx = 0; idx < total; idx++) {
      const o = idx * 4;
      if (seen[idx]) continue;
      const r = d[o];
      const g = d[o + 1];
      const b = d[o + 2];
      if (r >= 248 && g >= 248 && b >= 248 && Math.max(r, g, b) - Math.min(r, g, b) < 10) {
        d[o] = 255;
        d[o + 1] = 255;
        d[o + 2] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
  }

  /** Studio photos have near-white edges on all sides; indoor shots have dark floor at bottom edge. */
  function isStudioWhiteBackground(img) {
    const maxProbe = 320;
    const scale = Math.min(1, maxProbe / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    function edgeNearWhiteRatio() {
      let near = 0;
      let total = 0;
      for (let x = 0; x < w; x++) {
        for (const y of [0, h - 1]) {
          const i = (y * w + x) * 4;
          total++;
          if (nearWhiteAt(data, i)) near++;
        }
      }
      for (let y = 1; y < h - 1; y++) {
        for (const x of [0, w - 1]) {
          const i = (y * w + x) * 4;
          total++;
          if (nearWhiteAt(data, i)) near++;
        }
      }
      return near / total;
    }

    const edgeRatio = edgeNearWhiteRatio();
    const fullRatio = measureNearWhiteRatio(c);
    return edgeRatio >= 0.72 && fullRatio >= 0.5;
  }

  /** SupplierDen / Meesho style: 1:1 square white canvas, product centered ~62% coverage. */
  function prepareSquareCanvas(img, size, coverage) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    const maxSide = Math.round(size * coverage);
    const scale = Math.min(maxSide / img.width, maxSide / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
    return c;
  }

  /** White studio: keep original dimensions. Busy indoor: square canvas for Meesho shipping slab. */
  function prepareCanvas(img) {
    let w = img.width;
    let h = img.height;
    const max = Math.max(w, h);
    if (max > MAX_SIDE) {
      const scale = MAX_SIDE / max;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    if (measureNearWhiteRatio(c) >= WHITE_BG_THRESHOLD) {
      flattenBackgroundWhite(c);
    }
    return c;
  }

  /** Hit target KB — maximize quality up to the byte cap. */
  async function compressCanvas(canvas, targetBytes, minQ, whiteRatio) {
    const absMin = adaptiveAbsMinQ(whiteRatio);
    let lo = minQ;
    let hi = 92;
    let best = await encodeAtQuality(canvas, minQ, minQ, whiteRatio);

    if (best.size <= targetBytes) {
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const blob = await encodeAtQuality(canvas, mid, minQ, whiteRatio);
        if (blob.size <= targetBytes) {
          best = blob;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      const top = await encodeAtQuality(canvas, lo, minQ, whiteRatio);
      if (top.size <= targetBytes) return top;
    }

    for (let q = minQ - 1; q >= absMin && best.size > targetBytes; q--) {
      const blob = await encodeAtQuality(canvas, q, absMin, whiteRatio);
      if (blob.size <= targetBytes) return blob;
      if (blob.size < best.size) best = blob;
    }

    return best;
  }

  async function buildVariants(canvas, whiteRatio) {
    const minQ = adaptiveMinQ(whiteRatio);
    const tiers = tiersForWhite(whiteRatio);
    const built = [];
    for (const tier of tiers) {
      const targetBytes = tier.targetKb * 1024;
      const blob = await compressCanvas(canvas, targetBytes, minQ, whiteRatio);
      built.push({
        blob,
        bytes: blob.size,
        label: `${tier.label} · ${canvas.width}×${canvas.height}`,
        recommended: !!tier.recommended,
        lowest: !!tier.lowest,
      });
    }
    return built;
  }

  async function buildSquareVariants(img) {
    const built = [];
    for (const tier of SQUARE_VARIANTS_BUSY) {
      const canvas = prepareSquareCanvas(img, tier.canvas, tier.coverage);
      const whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
      const minQ = adaptiveMinQ(whiteRatio);
      const targetBytes = tier.targetKb * 1024;
      const blob = await compressCanvas(canvas, targetBytes, minQ, whiteRatio);
      built.push({
        blob,
        bytes: blob.size,
        label: `${tier.label} · ${tier.canvas}×${tier.canvas}`,
        recommended: !!tier.recommended,
        lowest: !!tier.lowest,
      });
    }
    return built;
  }

  async function optimizeToVariants(source) {
    await loadMozjpeg();
    const img = source instanceof File ? await loadImageFromFile(source) : await loadImageFromUrl(source);
    if (!isStudioWhiteBackground(img)) {
      return buildSquareVariants(img);
    }
    const canvas = prepareCanvas(img);
    const whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
    return buildVariants(canvas, whiteRatio);
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
      req.results = await optimizeToVariants(imageFile).then((v) => variantsToResults(v, tagName));
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
        body: { ok: true, api: "own", service: "own-api.js", version: 23, platform: "cloudflare-static" },
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
