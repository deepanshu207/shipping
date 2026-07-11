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
const MEESHO_FRAMED_MAX_SIDE = 1280;
const OVERLAY_SUPERSAMPLE = 2;

const STUDIO_CATEGORY_RE =
  /\b(bra|bras|lingerie|panty|panties|underwear|bikini|sports bra|feeding bra|shapewear|camisole|nighty|nightwear|blouse|petticoat)\b/i;
const INDOOR_CATEGORY_RE = /\b(raincoat|rain coat|rainwear|men raincoat)\b/i;

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

/** Proportional downscale — framed max side ≤ 1280 (Meesho shipping tier). */
function fitSupplierDenPhotoDims(w, h) {
  let nw = w;
  let nh = h;
  const max0 = Math.max(nw, nh);
  if (max0 > 2000) {
    const scale = 2000 / max0;
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

function specialOfferSvg(scale) {
  const w = 92 * scale;
  const h = 54 * scale;
  const pad = 8 * scale;
  const bw = w + pad * 2;
  const bh = h + pad * 2;
  const font = 12.5 * scale;
  const ss = OVERLAY_SUPERSAMPLE;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bw * ss)}" height="${Math.ceil(bh * ss)}" viewBox="0 0 ${Math.ceil(bw)} ${Math.ceil(bh)}">
    <g transform="translate(${pad},${pad}) rotate(-8 ${w / 2} ${h / 2})">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${7 * scale}" fill="#D32F2F" stroke="#FFD600" stroke-width="${3 * scale}"/>
      <text x="${w / 2}" y="${h * 0.34}" fill="#FFD600" stroke="#B71C1C" stroke-width="${0.55 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle" dominant-baseline="middle">SPECIAL</text>
      <text x="${w / 2}" y="${h * 0.72}" fill="#FFD600" stroke="#B71C1C" stroke-width="${0.55 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle" dominant-baseline="middle">OFFER</text>
    </g>
  </svg>`);
}

function hotSaleSvg(scale) {
  const outer = 78 * scale;
  const pad = 14 * scale;
  const size = outer * 2 + pad * 2;
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
  const ss = OVERLAY_SUPERSAMPLE;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size * ss)}" height="${Math.ceil(size * ss)}" viewBox="0 0 ${Math.ceil(size)} ${Math.ceil(size)}">
    <polygon points="${points.trim()}" fill="url(#burst)" stroke="#B71C1C" stroke-width="${2.4 * scale}"/>
    <defs>
      <radialGradient id="burst">
        <stop offset="0%" stop-color="#FFEB3B"/>
        <stop offset="55%" stop-color="#FF9800"/>
        <stop offset="100%" stop-color="#E53935"/>
      </radialGradient>
    </defs>
    <text x="${center}" y="${center - 14 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.5 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${15 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">HOT</text>
    <text x="${center}" y="${center + 4 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.45 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${13 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">SALE</text>
    <text x="${center}" y="${center + 22 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.6 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${12 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">BIG SALE</text>
  </svg>`);
}

async function prepareSupplierDenBuffer(buffer, width, height) {
  const border = supplierDenBorderPx(width, height);
  const fw = width + border * 2;
  const fh = height + border * 2;
  const scale = Math.max(0.78, Math.min(1.35, Math.min(width, height) / 900));
  const burstScale = scale * 1.05;
  const badge = { w: 92 * scale + 16 * scale, h: 54 * scale + 16 * scale };
  const burst = { size: 78 * burstScale * 2 + 28 * burstScale };

  const offerLeft = Math.round(border + width * 0.66);
  const offerTop = Math.round(border + height * 0.05);
  const burstLeft = Math.round(border + width * 0.16 - burst.size / 2);
  const burstTop = Math.round(border + height * 0.72 - burst.size / 2);

  const framed = await sharp({
    create: { width: fw, height: fh, channels: 3, background: SUPPLIERDEN_ORANGE },
  })
    .composite([
      { input: buffer, left: border, top: border },
      { input: specialOfferSvg(scale), left: offerLeft, top: offerTop },
      { input: hotSaleSvg(burstScale), left: burstLeft, top: burstTop },
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

function resolveStudioMode(buffer, categoryName) {
  const tag = String(categoryName || "").toLowerCase();
  if (tag.includes("indoor") || tag.includes("busy") || INDOOR_CATEGORY_RE.test(tag)) return false;
  if (tag.includes("studio") || tag.includes("white studio") || STUDIO_CATEGORY_RE.test(tag)) return true;
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

async function compressBusyToSlabOnce(buffer, slabKb) {
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

async function compressBusyToSlab(buffer, slabKb) {
  const targetBytes = slabKb * 1024;
  let work = buffer;
  let w = (await sharp(work).metadata()).width || 0;
  let h = (await sharp(work).metadata()).height || 0;
  for (let attempt = 0; attempt < 10; attempt++) {
    const out = await compressBusyToSlabOnce(work, slabKb);
    if (out.length <= targetBytes) return out;
    if (Math.max(w, h) <= 480) return out;
    w = Math.max(1, Math.round(w * 0.92));
    h = Math.max(1, Math.round(h * 0.92));
    work = await sharp(work).resize(w, h, { fit: "fill" }).png().toBuffer();
  }
  return compressBusyToSlabOnce(work, slabKb);
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
  let buffer = await sharp(imageBuffer).rotate().toBuffer();

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
    const rawCheck = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    whiteRatio = measureNearWhiteRatioRaw(
      rawCheck.data,
      rawCheck.info.width,
      rawCheck.info.height,
      rawCheck.info.channels
    );
  } else {
    buffer = await sharp(buffer).flatten({ background: { r: 255, g: 255, b: 255 } }).toBuffer();
    const fitted = fitSupplierDenPhotoDims(w, h);
    if (fitted.w !== w || fitted.h !== h) {
      buffer = await sharp(buffer)
        .resize(fitted.w, fitted.h, { fit: "fill" })
        .toBuffer();
      w = fitted.w;
      h = fitted.h;
    }
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
  const rotated = await sharp(imageBuffer).rotate().toBuffer();
  const studio = await resolveStudioMode(rotated, categoryName);
  const prepared = await prepareInput(imageBuffer, studio);
  const tiers = studio ? TIERS_WHITE_BG : TIERS_BUSY_BG;
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
