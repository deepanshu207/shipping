/**
 * Own API for Meesho Image Generator — runs entirely in the browser.
 */
(function () {
  /** Busy/indoor: SupplierDen format, then compress to Meesho slab sizes (empirical, not guaranteed ₹). */
  const TIERS_BUSY_BG = [
    { slabKb: 91, label: "Lowest · may beat ₹93 on Meesho", lowest: true },
    { slabKb: 92, label: "Balanced" },
    { slabKb: 93, label: "Recommended · SupplierDen ₹93 match", recommended: true },
    { slabKb: 94, label: "High detail backup" },
  ];
  const TIERS_WHITE_BG = [
    { targetKb: 20, label: "Smallest file · verify ₹ on Meesho", lowest: true },
    { targetKb: 22, label: "Recommended · white studio", recommended: true },
    { targetKb: 24, label: "Standard" },
    { targetKb: 26, label: "High detail" },
  ];

  const WHITE_TOL = 42;
  const WHITE_BG_THRESHOLD = 0.62;
  const ABS_MIN_Q = 18;
  const BUSY_MIN_Q = 15;
  const MAX_SIDE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 1200 : 2000;
  const MOZJPEG_TIMEOUT_MS = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 90000 : 45000;
  const STALE_PROCESSING_MS = 120000;
  const PROCESS_TIMEOUT_MS = 180000;
  const MOZJPEG_URL = () => new URL("/vendor/mozjpeg.mjs", location.origin).href;
  const SUPPLIERDEN_ORANGE = "#FF7900";
  const SUPPLIERDEN_BORDER_RATIO = 0.048;
  const SUPPLIERDEN_MIN_BORDER = 34;
  /** Meesho may tier on max framed side — SupplierDen outputs often cap near 1280px. */
  const MEESHO_FRAMED_MAX_SIDE = 1280;
  /** Draw stickers at 2× then downscale — sharper text after JPEG without changing frame size. */
  const OVERLAY_SUPERSAMPLE = 2;

  const STUDIO_CATEGORY_RE =
    /\b(bra|bras|lingerie|panty|panties|underwear|bikini|sports bra|feeding bra|shapewear|camisole|nighty|nightwear|blouse|petticoat)\b/i;
  const INDOOR_CATEGORY_RE = /\b(raincoat|rain coat|rainwear|men raincoat)\b/i;

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

  async function encodeAtQuality(canvas, quality, floor, whiteRatio, studio) {
    const minQ = floor ?? adaptiveMinQ(whiteRatio ?? 0);
    const q = Math.max(minQ, Math.min(100, Math.round(quality)));
    if (!studio) {
      return blobAtCanvasQuality(canvas, q / 100);
    }
    return encodeMozjpeg(canvas, q, whiteRatio, false);
  }

  function blobAtCanvasQuality(canvas, quality, minQuality = 0.28) {
    const q = Math.max(minQuality, Math.min(0.98, quality));
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || new Blob()), "image/jpeg", q));
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

  /** Studio photos: white edges / high white fill. Indoor shots have dark floor at bottom. */
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

    function sideNearWhiteRatio(y0, y1, x0, x1) {
      let near = 0;
      let total = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          total++;
          if (nearWhiteAt(data, i)) near++;
        }
      }
      return total ? near / total : 0;
    }

    const top = sideNearWhiteRatio(0, 1, 0, w);
    const bottom = sideNearWhiteRatio(h - 1, h, 0, w);
    const left = sideNearWhiteRatio(0, h, 0, 1);
    const right = sideNearWhiteRatio(0, h, w - 1, w);
    const allEdges = (top + bottom + left + right) / 4;
    const topLeftRight = (top + left + right) / 3;
    const full = measureNearWhiteRatio(c);

    if (allEdges >= 0.72 && full >= 0.5) return true;
    if (topLeftRight >= 0.8 && full >= 0.55) return true;
    if (full >= 0.7) return true;
    return false;
  }

  /** Category + vision — bra/lingerie never get SupplierDen orange frame. */
  function resolveStudioMode(img, tagName) {
    const tag = String(tagName || "").toLowerCase();
    if (INDOOR_CATEGORY_RE.test(tag)) return false;
    if (STUDIO_CATEGORY_RE.test(tag)) return true;
    return isStudioWhiteBackground(img);
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

  function supplierDenFramedMaxSide(w, h) {
    return Math.max(w, h) + supplierDenBorderPx(w, h) * 2;
  }

  /** Proportional downscale only — keeps aspect ratio, no crop; Meesho tiers on framed max side (~1280). */
  function fitSupplierDenPhotoDims(w, h) {
    let nw = w;
    let nh = h;
    const max0 = Math.max(nw, nh);
    if (max0 > MAX_SIDE) {
      const scale = MAX_SIDE / max0;
      nw = Math.round(nw * scale);
      nh = Math.round(nh * scale);
    }
    for (let i = 0; i < 12 && supplierDenFramedMaxSide(nw, nh) > MEESHO_FRAMED_MAX_SIDE; i++) {
      const framed = supplierDenFramedMaxSide(nw, nh);
      const scale = (MEESHO_FRAMED_MAX_SIDE - 1) / framed;
      nw = Math.max(1, Math.round(nw * scale));
      nh = Math.max(1, Math.round(nh * scale));
    }
    return { w: nw, h: nh };
  }

  function scaleCanvas(canvas, factor) {
    const w = Math.max(1, Math.round(canvas.width * factor));
    const h = Math.max(1, Math.round(canvas.height * factor));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, w, h);
    return c;
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

  function drawStickerText(ctx, text, x, y, fontSize, scale, options = {}) {
    const weight = options.weight ?? 900;
    const fill = options.fill ?? "#FFFFFF";
    const stroke = options.stroke ?? "#7F0000";
    const strokeWidth = (options.strokeWidth ?? 1.35) * scale;
    ctx.font = `${weight} ${fontSize * scale}px Arial,Helvetica,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function renderSpecialOfferBadge(scale) {
    const w = 92 * scale;
    const h = 54 * scale;
    const pad = 8 * scale;
    const bw = w + pad * 2;
    const bh = h + pad * 2;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(bw * ss);
    c.height = Math.ceil(bh * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.translate(pad, pad);
    ctx.rotate(-0.14);
    roundRectPath(ctx, 0, 0, w, h, 7 * scale);
    ctx.fillStyle = "#D32F2F";
    ctx.fill();
    ctx.strokeStyle = "#FFD600";
    ctx.lineWidth = 3 * scale;
    ctx.stroke();
    const fontSize = 12.5 * scale;
    ctx.font = `900 ${fontSize}px Arial,Helvetica,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.55 * scale;
    ctx.strokeStyle = "#B71C1C";
    ctx.fillStyle = "#FFD600";
    ctx.strokeText("SPECIAL", w / 2, h * 0.34);
    ctx.fillText("SPECIAL", w / 2, h * 0.34);
    ctx.strokeText("OFFER", w / 2, h * 0.72);
    ctx.fillText("OFFER", w / 2, h * 0.72);
    return { canvas: c, width: bw, height: bh };
  }

  function renderHotSaleBurst(scale) {
    const spikes = 14;
    const outer = 78 * scale;
    const inner = 34 * scale;
    const pad = 14 * scale;
    const size = outer * 2 + pad * 2;
    const center = size / 2;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(size * ss);
    c.height = Math.ceil(size * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.translate(center, center);
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
    ctx.lineWidth = 2.4 * scale;
    ctx.stroke();
    drawStickerText(ctx, "HOT", 0, -14 * scale, 15, scale, { strokeWidth: 1.5 });
    drawStickerText(ctx, "SALE", 0, 4 * scale, 13, scale, { strokeWidth: 1.45 });
    drawStickerText(ctx, "BIG SALE", 0, 22 * scale, 12, scale, { strokeWidth: 1.6 });
    return { canvas: c, width: size, height: size };
  }

  function drawSupplierDenOverlays(ctx, border, photoW, photoH) {
    const scale = Math.max(0.78, Math.min(1.35, Math.min(photoW, photoH) / 900));
    const badge = renderSpecialOfferBadge(scale);
    const burst = renderHotSaleBurst(scale * 1.05);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(badge.canvas, border + photoW * 0.66, border + photoH * 0.05, badge.width, badge.height);
    ctx.drawImage(
      burst.canvas,
      border + photoW * 0.16 - burst.width / 2,
      border + photoH * 0.72 - burst.height / 2,
      burst.width,
      burst.height
    );
  }

  /** SupplierDen-style orange frame + sale stickers — photo scaled to Meesho framed cap. */
  function prepareSupplierDenCanvas(img) {
    const fitted = fitSupplierDenPhotoDims(img.width, img.height);
    const w = fitted.w;
    const h = fitted.h;

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

  /** Exact upload dimensions — never upscale; cap max side at 2000 only. */
  function prepareCanvas(img, studio) {
    if (!studio) return prepareSupplierDenCanvas(img);

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
    return c;
  }

  /** Highest-quality standard JPEG at or under slab KB — downscale if q floor still exceeds slab. */
  async function compressBusyToSlabOnce(canvas, slabKb) {
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

  async function compressBusyToSlab(canvas, slabKb) {
    const targetBytes = slabKb * 1024;
    let work = canvas;
    for (let attempt = 0; attempt < 10; attempt++) {
      const blob = await compressBusyToSlabOnce(work, slabKb);
      if (blob.size <= targetBytes) return blob;
      if (Math.max(work.width, work.height) <= 480) return blob;
      work = scaleCanvas(work, 0.92);
    }
    return compressBusyToSlabOnce(work, slabKb);
  }

  /** Hit byte target for studio white-bg photos (mozjpeg). */
  async function compressCanvas(canvas, targetBytes, minQ, whiteRatio, studio) {
    if (!studio) {
      throw new Error("compressCanvas is studio-only; use compressBusyAtQuality for busy photos");
    }

    const absMin = adaptiveAbsMinQ(whiteRatio);
    let lo = minQ;
    let hi = 92;
    let best = await encodeMozjpeg(canvas, minQ, whiteRatio, false);

    if (best.size <= targetBytes) {
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const blob = await encodeMozjpeg(canvas, mid, whiteRatio, false);
        if (blob.size <= targetBytes) {
          best = blob;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      const top = await encodeMozjpeg(canvas, lo, whiteRatio, false);
      if (top.size <= targetBytes) return top;
    }

    for (let q = minQ - 1; q >= absMin && best.size > targetBytes; q--) {
      const blob = await encodeMozjpeg(canvas, q, whiteRatio, false);
      if (blob.size <= targetBytes) return blob;
      if (blob.size < best.size) best = blob;
    }

    return best;
  }

  async function buildVariants(canvas, whiteRatio, studio) {
    const minQ = adaptiveMinQ(whiteRatio);
    const tiers = studio ? TIERS_WHITE_BG : TIERS_BUSY_BG;
    const processingPath = studio ? "studio" : "supplierden";
    const built = [];
    for (const tier of tiers) {
      const blob = studio
        ? await compressCanvas(canvas, tier.targetKb * 1024, minQ, whiteRatio, true)
        : await compressBusyToSlab(canvas, tier.slabKb);
      built.push({
        blob,
        bytes: blob.size,
        label: `${tier.label} · ${canvas.width}×${canvas.height}`,
        recommended: !!tier.recommended,
        lowest: !!tier.lowest,
        processingPath,
        width: canvas.width,
        height: canvas.height,
      });
    }
    return built;
  }

  async function optimizeToVariants(source, tagName) {
    await loadMozjpeg();
    const img = source instanceof File ? await loadImageFromFile(source) : await loadImageFromUrl(source);
    const studio = resolveStudioMode(img, tagName);
    const canvas = prepareCanvas(img, studio);
    const whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
    return buildVariants(canvas, whiteRatio, studio);
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
        body: { ok: true, api: "own", service: "own-api.js", version: 37, platform: "cloudflare-static" },
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
