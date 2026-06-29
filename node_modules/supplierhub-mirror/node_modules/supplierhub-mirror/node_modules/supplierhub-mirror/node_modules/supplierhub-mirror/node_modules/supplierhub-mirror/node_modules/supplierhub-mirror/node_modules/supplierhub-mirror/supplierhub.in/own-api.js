/**
 * Own API for Meesho Image Generator — runs entirely in the browser.
 */
(function () {
  const TIER_SPECS = [
    { ratio: 0.7, capKb: 38, label: "Lowest · upload this first", lowest: true },
    { ratio: 0.78, capKb: 45, label: "Recommended · balanced", recommended: true },
    { ratio: 0.86, capKb: 50, label: "Standard" },
    { ratio: 0.92, capKb: 55, label: "High detail" },
  ];

  function tierTarget(inputBytes, spec) {
    const fromRatio = Math.floor(inputBytes * spec.ratio);
    const fromCap = spec.capKb * 1024;
    return Math.max(12 * 1024, Math.min(fromRatio, fromCap));
  }

  function pickCanvas(imgW, imgH, inputBytes) {
    const maxSide = Math.max(imgW, imgH);
    let canvas = Math.min(2000, Math.ceil(maxSide / 50) * 50);
    if (canvas < maxSide) canvas = maxSide;
    if (inputBytes <= 80 * 1024 && maxSide <= 1400) {
      canvas = Math.min(canvas, Math.max(1000, Math.ceil(maxSide / 100) * 100));
    }
    return canvas;
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
      path === "/auth/me" ||
      path === "/auth/logout" ||
      path === "/api/health" ||
      path.startsWith("/api/meesho/")
    );
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

  async function blobAtQuality(canvas, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  }

  /** Binary search: best quality that fits under targetBytes (same pixel dimensions). */
  async function compressCanvas(canvas, targetBytes, startQ, minQ) {
    let lo = minQ;
    let hi = startQ;
    let best = await blobAtQuality(canvas, minQ);

    while (hi - lo > 0.008) {
      const mid = (lo + hi) / 2;
      const blob = await blobAtQuality(canvas, mid);
      if (blob.size <= targetBytes) {
        best = blob;
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const top = await blobAtQuality(canvas, startQ);
    if (top.size <= targetBytes) return top;
    return best;
  }

  async function renderVariant(img, canvas, targetBytes, spec, inputBytes) {
    const out = document.createElement("canvas");
    out.width = canvas;
    out.height = canvas;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas, canvas);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const maxSide = Math.round(canvas * 0.96);
    const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    ctx.drawImage(img, Math.round((canvas - w) / 2), Math.round((canvas - h) / 2), w, h);

    let blob = await compressCanvas(out, targetBytes, 0.84, 0.52);

    if (inputBytes && blob.size > inputBytes) {
      blob = await compressCanvas(out, Math.floor(inputBytes * 0.88), 0.78, 0.45);
    }

    return {
      blob,
      bytes: blob.size,
      label: `${spec.label} · ${canvas}px`,
      recommended: !!spec.recommended,
      lowest: !!spec.lowest,
    };
  }

  async function optimizeToVariants(source) {
    const inputBytes = source instanceof File ? source.size : 52000;
    const img = source instanceof File ? await loadImageFromFile(source) : await loadImageFromUrl(source);
    const canvas = pickCanvas(img.width, img.height, inputBytes);
    const built = [];
    for (const spec of TIER_SPECS) {
      built.push(await renderVariant(img, canvas, tierTarget(inputBytes, spec), spec, inputBytes));
    }
    return built;
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
    try {
      req.results = await optimizeToVariants(imageFile).then((v) => variantsToResults(v, tagName));
      req.status = "completed";
    } catch (e) {
      req.status = "failed";
      req.error = String(e);
      console.error("[own-api] processImage failed:", e);
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
      return { status: 200, body: { ok: true, api: "own", service: "own-api.js" } };
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
      const history = [...STORE.requests.entries()]
        .map(([id, req]) => ({
          requestId: id,
          status: req.status,
          tagName: req.tagName,
          createdAt: req.createdAt,
          results: req.status === "completed" ? req.results : [],
        }))
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
      STORE.requests.set(id, {
        createdAt: Date.now(),
        tagName,
        status: "processing",
        results: [],
      });
      processImage(id, image, tagName);
      return { status: 200, body: { requestId: id } };
    }

    const poll = path.match(/^\/api\/meesho\/request(?:-status)?\/([^/]+)$/);
    if (poll && method === "GET") {
      const id = poll[1];
      const req = STORE.requests.get(id);
      if (!req) return { status: 404, body: { message: "Request not found" } };
      if (req.status === "failed") return { status: 200, body: { status: "failed", results: [] } };
      if (Date.now() - req.createdAt < 2500 || req.status !== "completed") {
        return { status: 200, body: { status: "processing", results: [] } };
      }
      return { status: 200, body: { status: "completed", results: req.results } };
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
  console.info("[own-api] Meesho tool uses own API (browser) — not SupplierHub");
})();
