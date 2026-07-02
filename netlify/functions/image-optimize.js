import sharp from "sharp";

const TIERS_BUSY_BG = [
  { targetKb: 91, label: "Lowest · upload to Meesho first", lowest: true },
  { targetKb: 92, label: "Recommended · balanced", recommended: true },
  { targetKb: 93, label: "Standard" },
  { targetKb: 93, label: "High detail" },
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

function standardJpeg(buffer, quality) {
  const q = Math.max(28, Math.min(98, quality));
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

async function compressToTarget(buffer, targetBytes, minQ, whiteRatio, studio) {
  if (!studio) {
    let best = await standardJpeg(buffer, 98).toBuffer();
    if (best.length > targetBytes) {
      for (let q = 98; q >= 28; q -= 2) {
        const out = await standardJpeg(buffer, q).toBuffer();
        if (out.length < best.length) best = out;
        if (out.length <= targetBytes) {
          best = out;
          break;
        }
      }
    }
    if (best.length <= targetBytes) return best;

    let mBest = await mozjpeg(buffer, ABS_MIN_Q, whiteRatio).toBuffer();
    for (let q = ABS_MIN_Q; q <= 85; q++) {
      const out = await mozjpeg(buffer, q, whiteRatio).toBuffer();
      if (out.length <= targetBytes) return out;
      if (out.length < mBest.length) mBest = out;
    }
    return mBest.length < best.length ? mBest : best;
  }

  const absMin = adaptiveAbsMinQ(whiteRatio);
  let lo = studio ? minQ : absMin;
  let hi = studio ? 92 : 98;
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
  const targetBytes = tier.targetKb * 1024;
  const jpeg = await compressToTarget(
    prepared.buffer,
    targetBytes,
    prepared.minQ,
    prepared.whiteRatio,
    prepared.studio
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
    lowest: item.fileSizeBytes === minBytes,
    recommended: item.recommended,
    categoryName,
  }));
}
