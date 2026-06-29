/**
 * Optimizes product images in the browser before upload and on API results,
 * so downloaded files are always smaller Meesho-style JPEGs.
 */
(function () {
  const VARIANTS = [
    { canvas: 1000, coverage: 0.58, quality: 0.72, label: "Tier 1" },
    { canvas: 1000, coverage: 0.62, quality: 0.68, label: "Tier 2" },
    { canvas: 1200, coverage: 0.62, quality: 0.65, label: "Tier 3" },
    { canvas: 2000, coverage: 0.65, quality: 0.62, label: "Tier 4" },
  ];

  const OPT_FLAG = "__meeshoOptimized";

  function kb(bytes) {
    return Math.max(1, Math.ceil(bytes / 1024));
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
    for (const variant of VARIANTS) {
      built.push(await renderVariant(img, variant));
    }
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

  async function replaceFileInput(input, file) {
    input[OPT_FLAG] = true;
    const optimized = await optimizeFile(file);
    const dt = new DataTransfer();
    dt.items.add(optimized);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  document.addEventListener(
    "change",
    (e) => {
      const input = e.target;
      if (!input || input.type !== "file" || input[OPT_FLAG]) return;
      const file = input.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      replaceFileInput(input, file).catch((err) => console.warn("[optimize-client] upload optimize failed:", err));
    },
    true
  );

  // Intercept axios XHR before response is consumed
  const NativeXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new NativeXHR();
    let _url = "";
    let _json = null;
    let _optimized = false;

    const origOpen = xhr.open.bind(xhr);
    xhr.open = function (method, url) {
      _url = String(url);
      return origOpen(method, url);
    };

    xhr.addEventListener("readystatechange", function () {
      if (xhr.readyState !== 4 || _optimized) return;
      if (!_url.includes("/api/meesho/request") || xhr.status < 200 || xhr.status >= 300) return;

      try {
        const data = JSON.parse(xhr.responseText);
        if (data.status !== "completed" || !data.results?.length || data.results[0][OPT_FLAG]) return;

        _optimized = true;
        const source = data.results[0].imageUrl;
        optimizeToVariants(source)
          .then((variants) => variantsToResults(variants, data.results[0].tagName || "Product"))
          .then((results) => {
            const payload = JSON.stringify({ status: "completed", results });
            Object.defineProperty(xhr, "responseText", { value: payload });
            Object.defineProperty(xhr, "response", { value: payload });
            xhr.dispatchEvent(new Event("readystatechange"));
          })
          .catch((err) => console.warn("[optimize-client] result optimize failed:", err));
      } catch {
        /* ignore */
      }
    });

    return xhr;
  }
  PatchedXHR.prototype = NativeXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  console.info("[optimize-client] active — uploads & downloads will be compressed");
})();
