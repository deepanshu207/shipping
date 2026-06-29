import sharp from "sharp";

/** Meesho shipping tiers — smallest KB at exact pixel dimensions. */
const TIERS = [
  { targetKb: 24, label: "Lowest · upload to Meesho first", lowest: true },
  { targetKb: 26, label: "Recommended · balanced", recommended: true },
  { targetKb: 28, label: "Standard" },
  { targetKb: 30, label: "High detail" },
];

export function kbFromBytes(bytes) {
  return Math.max(1, Math.ceil(bytes / 1024));
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
    quantisationTable: 3,
  });
}

async function encodeAtQuality(buffer, quality) {
  return mozjpeg(buffer, quality).toBuffer();
}

async function binarySearch(buffer, targetBytes, lo, hi) {
  let best = await encodeAtQuality(buffer, lo);
  if (best.length > targetBytes) return best;

  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const out = await encodeAtQuality(buffer, mid);
    if (out.length <= targetBytes) {
      best = out;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const top = await encodeAtQuality(buffer, lo);
  return top.length <= targetBytes ? top : best;
}

/** Max mozjpeg compression — blur fallback keeps same dimensions. */
async function compressToTarget(buffer, targetBytes) {
  let jpeg = await binarySearch(buffer, targetBytes, 1, 90);
  if (jpeg.length <= targetBytes) return jpeg;

  jpeg = await encodeAtQuality(buffer, 1);
  if (jpeg.length <= targetBytes) return jpeg;

  const soft = await sharp(buffer).blur(0.35).toBuffer();
  jpeg = await binarySearch(soft, targetBytes, 1, 75);
  if (jpeg.length <= targetBytes) return jpeg;

  return encodeAtQuality(soft, 1);
}

export async function prepareInput(imageBuffer) {
  const inputBytes = imageBuffer.length;
  let pipeline = sharp(imageBuffer).rotate();

  let buffer = await pipeline
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

  return { buffer, width: w, height: h, inputBytes };
}

async function buildVariant(prepared, tier) {
  const targetBytes = tier.targetKb * 1024;
  const jpeg = await compressToTarget(prepared.buffer, targetBytes);

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
  const prepared = await prepareInput(imageBuffer);
  const built = [];

  for (const tier of TIERS) {
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
