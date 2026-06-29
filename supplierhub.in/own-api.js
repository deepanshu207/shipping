/**
 * Own API for Meesho Image Generator — runs entirely in the browser.
 */
(function () {
  /** SupplierDen-style: 32–38 KB at original (trimmed) dimensions. */
  const TIERS = [
    { targetKb: 32, label: "Lowest · upload to Meesho first", lowest: true },
    { targetKb: 34, label: "Recommended · balanced", recommended: true },
    { targetKb: 36, label: "Standard" },
    { targetKb: 38, label: "High detail" },
  ];

  const TRIM_THRESHOLD = 12;
  const MAX_SIDE = 2000;
  const Q_FLOOR = 0.08;
  const Q_CEIL = 0.92;

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

  /** Strip excess white borders (same as sharp trim threshold). */
  function trimNearWhite(canvas) {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    if (width < 2 || height < 2) return canvas;

    const { data } = ctx.getImageData(0, 0, width, height);

    function isBg(x, y) {
      const i = (y * width + x) * 4;
      return (
        255 - data[i] <= TRIM_THRESHOLD &&
        255 - data[i + 1] <= TRIM_THRESHOLD &&
        255 - data[i + 2] <= TRIM_THRESHOLD
      );
    }

    function rowHasContent(y) {
      for (let x = 0; x < width; x++) if (!isBg(x, y)) return true;
      return false;
    }

    function colHasContent(x, top, bottom) {
      for (let y = top; y <= bottom; y++) if (!isBg(x, y)) return true;
      return false;
    }

    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;

    while (top < bottom && !rowHasContent(top)) top++;
    while (bottom > top && !rowHasContent(bottom)) bottom--;
    while (left < right && !colHasContent(left, top, bottom)) left++;
    while (right > left && !colHasContent(right, top, bottom)) right--;

    const tw = right - left + 1;
    const th = bottom - top + 1;
    if (tw <= 0 || th <= 0 || (tw === width && th === height)) return canvas;

    const trimmed = document.createElement("canvas");
    trimmed.width = tw;
    trimmed.height = th;
    trimmed.getContext("2d").drawImage(canvas, left, top, tw, th, 0, 0, tw, th);
    return trimmed;
  }

  /** Draw at native size — never upscale; cap at 2000px max side only. */
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
    return trimNearWhite(c);
  }

  /** Binary search: highest JPEG quality that fits under targetBytes. */
  async function compressCanvas(canvas, targetBytes) {
    let lo = Q_FLOOR;
    let hi = Q_CEIL;
    let best = await blobAtQuality(canvas, Q_FLOOR);

    if (best.size > targetBytes) {
      for (let q = Q_FLOOR - 0.02; q >= 0.01; q -= 0.01) {
        const blob = await blobAtQuality(canvas, q);
        if (blob.size < best.size) best = blob;
        if (blob.size <= targetBytes) return blob;
      }
      return best;
    }

    while (hi - lo > 0.004) {
      const mid = (lo + hi) / 2;
      const blob = await blobAtQuality(canvas, mid);
      if (blob.size <= targetBytes) {
        best = blob;
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const top = await blobAtQuality(canvas, lo);
    return top.size <= targetBytes ? top : best;
  }

  async function renderVariant(img, tier) {
    const canvas = prepareCanvas(img);
    const targetBytes = tier.targetKb * 1024;
    const blob = await compressCanvas(canvas, targetBytes);

    return {
      blob,
      bytes: blob.size,
      label: `${tier.label} · ${canvas.width}×${canvas.height}`,
      recommended: !!tier.recommended,
      lowest: !!tier.lowest,
    };
  }

  async function optimizeToVariants(source) {
    const img = source instanceof File ? await loadImageFromFile(source) : await loadImageFromUrl(source);
    const built = [];
    for (const tier of TIERS) {
      built.push(await renderVariant(img, tier));
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
