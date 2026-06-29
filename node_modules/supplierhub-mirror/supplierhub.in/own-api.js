/**
 * Own API for Meesho Image Generator — runs entirely in the browser.
 */
(function () {
  const VARIANTS = [
    { canvas: 1000, coverage: 0.58, quality: 0.72, label: "Tier 1" },
    { canvas: 1000, coverage: 0.62, quality: 0.68, label: "Tier 2" },
    { canvas: 1200, coverage: 0.62, quality: 0.65, label: "Tier 3" },
    { canvas: 2000, coverage: 0.65, quality: 0.62, label: "Tier 4" },
  ];

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

  async function renderVariant(img, variant) {
    const canvas = document.createElement("canvas");
    canvas.width = variant.canvas;
    canvas.height = variant.canvas;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const maxSide = Math.round(variant.canvas * variant.coverage);
    const scale = Math.min(maxSide / img.width, maxSide / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    ctx.drawImage(img, Math.round((canvas.width - w) / 2), Math.round((canvas.height - h) / 2), w, h);

    let quality = variant.quality;
    let blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    while (blob.size > 180 * 1024 && quality > 0.45) {
      quality -= 0.05;
      blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    }
    return { blob, bytes: blob.size, label: variant.label };
  }

  async function optimizeToVariants(source) {
    const img = source instanceof File ? await loadImageFromFile(source) : await loadImageFromUrl(source);
    const built = [];
    for (const variant of VARIANTS) built.push(await renderVariant(img, variant));
    built.sort((a, b) => a.bytes - b.bytes);
    return built;
  }

  async function optimizeFile(file) {
    const variants = await optimizeToVariants(file);
    const best = variants[0];
    const name = (file.name || "product").replace(/\.\w+$/i, "") + `-${best.bytes}b.jpg`;
    return new File([best.blob], name, { type: "image/jpeg", lastModified: Date.now() });
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
    const out = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const imageUrl = await blobToDataUrl(v.blob);
      const fileSizeKb = kb(v.bytes);
      out.push({
        imageUrl,
        tagName: `${v.label} · ${fileSizeKb} KB`,
        fileSizeBytes: v.bytes,
        fileSizeKb,
        shippingCharge: String(fileSizeKb),
        lowest: i === 0,
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

  document.addEventListener(
    "change",
    (e) => {
      const input = e.target;
      if (!input || input.type !== "file" || input[OPT_FLAG]) return;
      const file = input.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      input[OPT_FLAG] = true;
      optimizeFile(file)
        .then((optimized) => {
          const dt = new DataTransfer();
          dt.items.add(optimized);
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        })
        .catch((err) => console.warn("[own-api] upload optimize failed:", err));
    },
    true
  );

  window.__MEESHO_OWN_API__ = true;
  console.info("[own-api] Meesho tool uses own API (browser) — not SupplierHub");
})();
