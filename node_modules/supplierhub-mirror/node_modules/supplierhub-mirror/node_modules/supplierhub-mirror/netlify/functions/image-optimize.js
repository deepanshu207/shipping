import sharp from "sharp";

/** SupplierHub-style: never upscale; output KB must stay below upload. */
const TIER_SPECS = [
  { ratio: 0.7, capKb: 38, label: "Lowest · upload this first", lowest: true },
  { ratio: 0.78, capKb: 45, label: "Recommended · balanced", recommended: true },
  { ratio: 0.86, capKb: 50, label: "Standard" },
  { ratio: 0.92, capKb: 55, label: "High detail" },
];

export function kbFromBytes(bytes) {
  return Math.max(1, Math.ceil(bytes / 1024));
}

function tierTarget(inputBytes, spec) {
  const fromRatio = Math.floor(inputBytes * spec.ratio);
  const fromCap = spec.capKb * 1024;
  return Math.max(12 * 1024, Math.min(fromRatio, fromCap));
}

function pickCanvas(contentW, contentH, inputBytes) {
  const maxSide = Math.max(contentW, contentH);
  let canvas = Math.min(2000, Math.ceil(maxSide / 50) * 50);
  if (canvas < maxSide) canvas = maxSide;

  if (inputBytes <= 80 * 1024 && maxSide <= 1400) {
    canvas = Math.min(canvas, Math.max(1000, Math.ceil(maxSide / 100) * 100));
  }
  return canvas;
}

function mozjpeg(buffer, quality) {
  return sharp(buffer).jpeg({
    quality,
    mozjpeg: true,
    chromaSubsampling: "4:2:0",
    progressive: true,
    optimizeScans: true,
    trellisQuantisation: true,
    overshootDeringing: true,
  });
}

async function encodeAtQuality(buffer, quality) {
  return mozjpeg(buffer, quality).toBuffer();
}

async function compressToTarget(buffer, targetBytes, startQuality = 82, minQuality = 55) {
  let best = await encodeAtQuality(buffer, minQuality);
  if (best.length <= targetBytes) return best;

  let lo = minQuality;
  let hi = startQuality;
  best = await encodeAtQuality(buffer, minQuality);

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const out = await encodeAtQuality(buffer, mid);
    if (out.length <= targetBytes) {
      best = out;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export async function prepareInput(imageBuffer) {
  const inputBytes = imageBuffer.length;
  let pipeline = sharp(imageBuffer).rotate();

  let trimmedBuffer;
  try {
    trimmedBuffer = await pipeline.clone().trim({ threshold: 15 }).toBuffer();
  } catch {
    trimmedBuffer = await pipeline.toBuffer();
  }

  let meta = await sharp(trimmedBuffer).metadata();
  let w = meta.width || 0;
  let h = meta.height || 0;

  if (Math.max(w, h) > 2000) {
    trimmedBuffer = await sharp(trimmedBuffer)
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
    meta = await sharp(trimmedBuffer).metadata();
    w = meta.width || w;
    h = meta.height || h;
  }

  return { buffer: trimmedBuffer, width: w, height: h, inputBytes };
}

async function composeOnCanvas(prepared, canvas) {
  const productMax = Math.round(canvas * 0.96);

  const product = await sharp(prepared.buffer)
    .resize(productMax, productMax, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();

  return sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: product, gravity: "center" }])
    .toBuffer();
}

async function directRecompress(prepared, targetBytes) {
  return compressToTarget(prepared.buffer, targetBytes, 80, 52);
}

async function buildVariant(prepared, canvas, targetBytes, spec) {
  const composed = await composeOnCanvas(prepared, canvas);
  let jpeg = await compressToTarget(composed, targetBytes, 84, 52);

  if (jpeg.length > prepared.inputBytes) {
    const direct = await directRecompress(prepared, targetBytes);
    if (direct.length < jpeg.length) jpeg = direct;
  }

  if (jpeg.length > prepared.inputBytes) {
    jpeg = await compressToTarget(composed, Math.floor(prepared.inputBytes * 0.88), 78, 48);
  }

  return {
    buffer: jpeg,
    fileSizeBytes: jpeg.length,
    fileSizeKb: kbFromBytes(jpeg.length),
    tagName: `${spec.label} · ${canvas}px`,
    recommended: !!spec.recommended,
    lowest: !!spec.lowest,
    canvas,
  };
}

export async function generateAllVariants(imageBuffer, categoryName) {
  const prepared = await prepareInput(imageBuffer);
  const canvas = pickCanvas(prepared.width, prepared.height, prepared.inputBytes);
  const built = [];

  for (const spec of TIER_SPECS) {
    const target = tierTarget(prepared.inputBytes, spec);
    built.push(await buildVariant(prepared, canvas, target, spec));
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
