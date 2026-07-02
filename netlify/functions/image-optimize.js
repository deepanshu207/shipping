import sharp from "sharp";

const MEESHO_CANVAS_SIZE = 2000;
const MEESHO_MAX_BYTES = 300 * 1024;
const MEESHO_VARIANTS = [
  { coverage: 0.62, quality: 82, label: "Tier 1 · Smallest frame (try first)", lowest: true },
  { coverage: 0.65, quality: 78, label: "Tier 2 · Compact" },
  { coverage: 0.68, quality: 74, label: "Tier 3 · Balanced", recommended: true },
  { coverage: 0.7, quality: 70, label: "Tier 4 · Standard Meesho size" },
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

const STUDIO_CATEGORY_RE =
  /\b(bra|bras|lingerie|panty|panties|underwear|bikini|sports bra|feeding bra|shapewear|camisole|nighty|nightwear|blouse|petticoat)\b/i;

export function kbFromBytes(bytes) {
  return Math.max(1, Math.ceil(bytes / 1024));
}

function mozjpeg(buffer, quality, whiteRatio = 0) {
  const q = Math.max(ABS_MIN_Q, quality);
  return sharp(buffer).jpeg({
    quality: q,
    mozjpeg: true,
    chromaSubsampling: "4:2:0",
    progressive: true,
    optimizeScans: true,
    trellisQuantisation: true,
    overshootDeringing: true,
    quantisationTable: whiteRatio >= WHITE_BG_THRESHOLD ? 3 : 2,
  });
}

function standardJpeg(buffer, quality, minQ = BUSY_MIN_Q) {
  const q = Math.max(minQ, Math.min(98, quality));
  return sharp(buffer).jpeg({
    quality: q,
    mozjpeg: false,
    progressive: false,
    chromaSubsampling: "4:2:0",
  });
}

async function encodeAtQuality(buffer, quality, floor, whiteRatio = 0, studio = false) {
  const minQ = floor ?? adaptiveMinQ(whiteRatio);
  const q = Math.max(minQ, quality);
  if (studio) {
    return mozjpeg(buffer, q, whiteRatio).toBuffer();
  }
  return standardJpeg(buffer, q).toBuffer();
}

function floodFillWhiteRaw(data, width, height, channels) {
  const total = width * height;
  const seen = new Uint8Array(total);
  const queue = [];

  function nearWhite(idx) {
    const o = idx * channels;
    return (
      255 - data[o] <= WHITE_TOL &&
      255 - data[o + 1] <= WHITE_TOL &&
      255 - data[o + 2] <= WHITE_TOL
    );
  }

  function push(idx) {
    if (seen[idx] || !nearWhite(idx)) return;
    seen[idx] = 1;
    queue.push(idx);
  }

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (queue.length) {
    const idx = queue.pop();
    const o = idx * channels;
    data[o] = 255;
    data[o + 1] = 255;
    data[o + 2] = 255;
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) push(idx - 1);
    if (x < width - 1) push(idx + 1);
    if (y > 0) push(idx - width);
    if (y < height - 1) push(idx + width);
  }

  let white = 0;
  for (let idx = 0; idx < total; idx++) {
    const o = idx * channels;
    if (!seen[idx]) {
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      if (r >= 248 && g >= 248 && b >= 248 && Math.max(r, g, b) - Math.min(r, g, b) < 10) {
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        seen[idx] = 1;
      }
    }
    if (data[o] === 255 && data[o + 1] === 255 && data[o + 2] === 255) white++;
  }

  return white / total;
}

function measureNearWhiteRatioRaw(data, width, height, channels) {
  let near = 0;
  const total = width * height;
  for (let idx = 0; idx < total; idx++) {
    const o = idx * channels;
    if (
      255 - data[o] <= WHITE_TOL &&
      255 - data[o + 1] <= WHITE_TOL &&
      255 - data[o + 2] <= WHITE_TOL
    ) {
      near++;
    }
  }
  return near / total;
}

function edgeNearWhiteRatioRaw(data, width, height, channels) {
  let near = 0;
  let total = 0;
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const o = (y * width + x) * channels;
      total++;
      if (
        255 - data[o] <= WHITE_TOL &&
        255 - data[o + 1] <= WHITE_TOL &&
        255 - data[o + 2] <= WHITE_TOL
      ) {
        near++;
      }
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      const o = (y * width + x) * channels;
      total++;
      if (
        255 - data[o] <= WHITE_TOL &&
        255 - data[o + 1] <= WHITE_TOL &&
        255 - data[o + 2] <= WHITE_TOL
      ) {
        near++;
      }
    }
  }
  return near / total;
}

function sideNearWhiteRatioRaw(data, width, height, channels, y0, y1, x0, x1) {
  let near = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * width + x) * channels;
      total++;
      if (
        255 - data[o] <= WHITE_TOL &&
        255 - data[o + 1] <= WHITE_TOL &&
        255 - data[o + 2] <= WHITE_TOL
      ) {
        near++;
      }
    }
  }
  return total ? near / total : 0;
}

async function isStudioWhiteBackground(buffer) {
  const { data, info } = await sharp(buffer)
    .resize(320, 320, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const top = sideNearWhiteRatioRaw(data, width, height, channels, 0, 1, 0, width);
  const bottom = sideNearWhiteRatioRaw(data, width, height, channels, height - 1, height, 0, width);
  const left = sideNearWhiteRatioRaw(data, width, height, channels, 0, height, 0, 1);
  const right = sideNearWhiteRatioRaw(data, width, height, channels, 0, height, width - 1, width);
  const allEdges = (top + bottom + left + right) / 4;
  const topLeftRight = (top + left + right) / 3;
  const fullRatio = measureNearWhiteRatioRaw(data, width, height, channels);
  if (allEdges >= 0.72 && fullRatio >= 0.5) return true;
  if (topLeftRight >= 0.8 && fullRatio >= 0.55) return true;
  if (fullRatio >= 0.7) return true;
  return false;
}

async function resolveStudioMode(buffer, categoryName) {
  const tag = String(categoryName || "").toLowerCase();
  if (STUDIO_CATEGORY_RE.test(tag)) return true;
  return isStudioWhiteBackground(buffer);
}

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

async function flattenBackgroundWhite(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const whiteRatio = floodFillWhiteRaw(data, info.width, info.height, info.channels);
  const out = await sharp(data, { raw: info }).removeAlpha().jpeg({ quality: 95, mozjpeg: true }).toBuffer();
  return { buffer: out, whiteRatio };
}

async function compressMeeshoTarget(buffer, quality) {
  let q = quality;
  let output = await sharp(buffer).jpeg({ quality: q, mozjpeg: true }).toBuffer();
  while (output.length > MEESHO_MAX_BYTES && q > 45) {
    q -= 5;
    output = await sharp(buffer).jpeg({ quality: q, mozjpeg: true }).toBuffer();
  }
  return output;
}

async function buildMeeshoVariant(imageBuffer, variant) {
  const productSize = Math.round(MEESHO_CANVAS_SIZE * variant.coverage);
  const product = await sharp(imageBuffer)
    .rotate()
    .resize(productSize, productSize, { fit: "inside", withoutEnlargement: false })
    .toBuffer();

  const composed = await sharp({
    create: {
      width: MEESHO_CANVAS_SIZE,
      height: MEESHO_CANVAS_SIZE,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: product, gravity: "center" }])
    .png()
    .toBuffer();

  const jpeg = await compressMeeshoTarget(composed, variant.quality);
  return {
    buffer: jpeg,
    fileSizeBytes: jpeg.length,
    fileSizeKb: kbFromBytes(jpeg.length),
    tagName: `${variant.label} · ${MEESHO_CANVAS_SIZE}×${MEESHO_CANVAS_SIZE}`,
    recommended: !!variant.recommended,
    lowest: !!variant.lowest,
    width: MEESHO_CANVAS_SIZE,
    height: MEESHO_CANVAS_SIZE,
    processingPath: "meesho",
  };
}

async function compressToTarget(buffer, targetBytes, minQ, whiteRatio) {
  const absMin = adaptiveAbsMinQ(whiteRatio);
  let lo = minQ;
  let hi = 92;
  let best = await encodeAtQuality(buffer, lo, lo, whiteRatio, true);

  if (best.length <= targetBytes) {
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      const out = await encodeAtQuality(buffer, mid, lo, whiteRatio, true);
      if (out.length <= targetBytes) {
        best = out;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const top = await encodeAtQuality(buffer, lo, lo, whiteRatio, true);
    if (top.length <= targetBytes) return top;
  }

  for (let q = lo - 1; q >= absMin && best.length > targetBytes; q--) {
    const out = await encodeAtQuality(buffer, q, absMin, whiteRatio, true);
    if (out.length <= targetBytes) return out;
    if (out.length < best.length) best = out;
  }

  return best;
}

export async function prepareStudioInput(imageBuffer) {
  const inputBytes = imageBuffer.length;
  let buffer = await sharp(imageBuffer)
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();

  let meta = await sharp(buffer).metadata();
  let w = meta.width || 0;
  let h = meta.height || 0;

  if (Math.max(w, h) > 2000) {
    buffer = await sharp(buffer)
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
    meta = await sharp(buffer).metadata();
    w = meta.width || w;
    h = meta.height || h;
  }

  const flat = await flattenBackgroundWhite(buffer);
  return {
    buffer: flat.buffer,
    width: w,
    height: h,
    inputBytes,
    whiteRatio: flat.whiteRatio,
    minQ: adaptiveMinQ(flat.whiteRatio),
  };
}

async function buildStudioVariant(prepared, tier) {
  const jpeg = await compressToTarget(
    prepared.buffer,
    tier.targetKb * 1024,
    prepared.minQ,
    prepared.whiteRatio
  );

  return {
    buffer: jpeg,
    fileSizeBytes: jpeg.length,
    fileSizeKb: kbFromBytes(jpeg.length),
    tagName: `${tier.label} · ${prepared.width}×${prepared.height}`,
    recommended: !!tier.recommended,
    lowest: !!tier.lowest,
    width: prepared.width,
    height: prepared.height,
    processingPath: "studio",
  };
}

export async function generateAllVariants(imageBuffer, categoryName) {
  const rotated = await sharp(imageBuffer).rotate().flatten({ background: { r: 255, g: 255, b: 255 } }).toBuffer();
  const studio = await resolveStudioMode(rotated, categoryName);
  let built = [];

  if (studio) {
    const prepared = await prepareStudioInput(imageBuffer);
    for (const tier of TIERS_WHITE_BG) {
      built.push(await buildStudioVariant(prepared, tier));
    }
  } else {
    for (const variant of MEESHO_VARIANTS) {
      built.push(await buildMeeshoVariant(imageBuffer, variant));
    }
    built.sort((a, b) => a.fileSizeBytes - b.fileSizeBytes);
    const minBytes = built[0]?.fileSizeBytes ?? 0;
    built = built.map((item) => ({ ...item, lowest: item.fileSizeBytes === minBytes }));
  }

  const minBytes = Math.min(...built.map((b) => b.fileSizeBytes));

  return built.map((item) => ({
    imageUrl: `data:image/jpeg;base64,${item.buffer.toString("base64")}`,
    tagName: `${item.tagName} · ${item.fileSizeKb} KB`,
    fileSizeBytes: item.fileSizeBytes,
    fileSizeKb: item.fileSizeKb,
    shippingCharge: String(item.fileSizeKb),
    estimatedShippingInr: item.fileSizeKb,
    shippingEstimate: true,
    processingPath: item.processingPath,
    width: item.width,
    height: item.height,
    lowest: item.fileSizeBytes === minBytes,
    recommended: item.recommended,
    categoryName,
  }));
}
