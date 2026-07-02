import sharp from "sharp";

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
const SUPPLIERDEN_ORANGE = { r: 255, g: 121, b: 0 };
const SUPPLIERDEN_BORDER_RATIO = 0.048;
const SUPPLIERDEN_MIN_BORDER = 34;

function supplierDenBorderPx(w, h) {
  return Math.max(SUPPLIERDEN_MIN_BORDER, Math.round(Math.min(w, h) * SUPPLIERDEN_BORDER_RATIO));
}

function specialOfferSvg(x, y, scale) {
  const w = 92 * scale;
  const h = 54 * scale;
  const font = 12 * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w + 20)}" height="${Math.ceil(h + 20)}">
    <g transform="translate(10,10) rotate(-8 ${w / 2} ${h / 2})">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${7 * scale}" fill="#D32F2F" stroke="#FFD600" stroke-width="${2.8 * scale}"/>
      <text x="${w / 2}" y="${h * 0.34}" fill="#FFD600" font-family="Arial,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle" dominant-baseline="middle">SPECIAL</text>
      <text x="${w / 2}" y="${h * 0.72}" fill="#FFD600" font-family="Arial,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle" dominant-baseline="middle">OFFER</text>
    </g>
  </svg>`);
}

function hotSaleSvg(cx, cy, scale) {
  const outer = 78 * scale;
  const size = Math.ceil(outer * 2 + 24);
  const center = size / 2;
  const spikes = 14;
  let points = "";
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    const radius = i % 2 === 0 ? outer : 34 * scale;
    const px = center + Math.cos(angle) * radius;
    const py = center + Math.sin(angle) * radius;
    points += `${px},${py} `;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <polygon points="${points.trim()}" fill="url(#burst)" stroke="#B71C1C" stroke-width="${2.2 * scale}"/>
    <defs>
      <radialGradient id="burst">
        <stop offset="0%" stop-color="#FFEB3B"/>
        <stop offset="55%" stop-color="#FF9800"/>
        <stop offset="100%" stop-color="#E53935"/>
      </radialGradient>
    </defs>
    <text x="${center}" y="${center - 14 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.1 * scale}" font-family="Arial,sans-serif" font-size="${15 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">HOT</text>
    <text x="${center}" y="${center + 4 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.1 * scale}" font-family="Arial,sans-serif" font-size="${13 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">SALE</text>
    <text x="${center}" y="${center + 22 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.1 * scale}" font-family="Arial,sans-serif" font-size="${11 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">BIG SALE</text>
  </svg>`);
}

async function prepareSupplierDenBuffer(buffer, width, height) {
  const border = supplierDenBorderPx(width, height);
  const fw = width + border * 2;
  const fh = height + border * 2;
  const scale = Math.max(0.72, Math.min(1.35, Math.min(width, height) / 900));
  const burstSize = Math.ceil(78 * scale * 1.05 * 2 + 24);
  const offerW = Math.ceil(92 * scale + 20);
  const offerH = Math.ceil(54 * scale + 20);

  const offerLeft = Math.round(border + width * 0.66);
  const offerTop = Math.round(border + height * 0.05);
  const burstLeft = Math.round(border + width * 0.16 - burstSize / 2);
  const burstTop = Math.round(border + height * 0.72 - burstSize / 2);

  const framed = await sharp({
    create: { width: fw, height: fh, channels: 3, background: SUPPLIERDEN_ORANGE },
  })
    .composite([
      { input: buffer, left: border, top: border },
      { input: specialOfferSvg(offerLeft, offerTop, scale), left: offerLeft, top: offerTop },
      { input: hotSaleSvg(0, 0, scale * 1.05), left: burstLeft, top: burstTop },
    ])
    .png()
    .toBuffer();

  return { buffer: framed, width: fw, height: fh, whiteRatio: 0 };
}

function tiersForWhite(whiteRatio) {
  return whiteRatio >= WHITE_BG_THRESHOLD ? TIERS_WHITE_BG : TIERS_BUSY_BG;
}

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

async function isStudioWhiteBackground(buffer) {
  const { data, info } = await sharp(buffer)
    .resize(320, 320, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const edgeRatio = edgeNearWhiteRatioRaw(data, info.width, info.height, info.channels);
  const fullRatio = measureNearWhiteRatioRaw(data, info.width, info.height, info.channels);
  return edgeRatio >= 0.72 && fullRatio >= 0.5;
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

async function compressBusyToSlab(buffer, slabKb) {
  const targetBytes = slabKb * 1024;
  const busyMin = BUSY_MIN_Q;
  let best = null;
  let lo = busyMin;
  let hi = 98;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const out = await standardJpeg(buffer, mid, busyMin).toBuffer();
    if (out.length <= targetBytes) {
      best = out;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best) return best;
  return standardJpeg(buffer, busyMin, busyMin).toBuffer();
}

async function compressToTarget(buffer, targetBytes, minQ, whiteRatio, studio) {
  if (!studio) {
    throw new Error("compressToTarget is studio-only; use compressBusyToSlab for busy photos");
  }

  const absMin = adaptiveAbsMinQ(whiteRatio);
  let lo = minQ;
  let hi = 92;
  let best = await encodeAtQuality(buffer, lo, lo, whiteRatio, studio);

  if (best.length <= targetBytes) {
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      const out = await encodeAtQuality(buffer, mid, lo, whiteRatio, studio);
      if (out.length <= targetBytes) {
        best = out;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const top = await encodeAtQuality(buffer, lo, lo, whiteRatio, studio);
    if (top.length <= targetBytes) return top;
  }

  for (let q = lo - 1; q >= absMin && best.length > targetBytes; q--) {
    const out = await encodeAtQuality(buffer, q, absMin, whiteRatio, studio);
    if (out.length <= targetBytes) return out;
    if (out.length < best.length) best = out;
  }

  return best;
}

export async function prepareInput(imageBuffer, studio) {
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

  let whiteRatio = 0;
  if (studio) {
    const flat = await flattenBackgroundWhite(buffer);
    buffer = flat.buffer;
    whiteRatio = flat.whiteRatio;
  } else {
    const framed = await prepareSupplierDenBuffer(buffer, w, h);
    buffer = framed.buffer;
    w = framed.width;
    h = framed.height;
    const rawCheck = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    whiteRatio = measureNearWhiteRatioRaw(
      rawCheck.data,
      rawCheck.info.width,
      rawCheck.info.height,
      rawCheck.info.channels
    );
  }

  return { buffer, width: w, height: h, inputBytes, whiteRatio, minQ: adaptiveMinQ(whiteRatio), studio };
}

async function buildVariant(prepared, tier) {
  const processingPath = prepared.studio ? "studio" : "supplierden";
  const jpeg = prepared.studio
    ? await compressToTarget(prepared.buffer, tier.targetKb * 1024, prepared.minQ, prepared.whiteRatio, true)
    : await compressBusyToSlab(prepared.buffer, tier.slabKb);

  return {
    buffer: jpeg,
    fileSizeBytes: jpeg.length,
    fileSizeKb: kbFromBytes(jpeg.length),
    tagName: `${tier.label} · ${prepared.width}×${prepared.height}`,
    recommended: !!tier.recommended,
    lowest: !!tier.lowest,
    width: prepared.width,
    height: prepared.height,
    processingPath,
  };
}

export async function generateAllVariants(imageBuffer, categoryName) {
  const rotated = await sharp(imageBuffer).rotate().flatten({ background: { r: 255, g: 255, b: 255 } }).toBuffer();
  const studio = await isStudioWhiteBackground(rotated);
  const prepared = await prepareInput(imageBuffer, studio);
  const tiers = tiersForWhite(prepared.whiteRatio);
  const built = [];

  for (const tier of tiers) {
    built.push(await buildVariant(prepared, tier));
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
