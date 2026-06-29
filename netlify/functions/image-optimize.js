import sharp from "sharp";

/** Meesho shipping tiers — fixed KB at native trimmed dimensions. */
const TIERS = [
  { targetKb: 28, label: "Lowest · upload to Meesho first", lowest: true },
  { targetKb: 30, label: "Recommended · balanced", recommended: true },
  { targetKb: 32, label: "Standard" },
  { targetKb: 34, label: "High detail" },
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

/** Binary search: highest mozjpeg quality that fits under targetBytes. */
async function compressToTarget(buffer, targetBytes) {
  let lo = 1;
  let hi = 85;
  let best = await encodeAtQuality(buffer, lo);

  if (best.length <= targetBytes) {
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

  return best;
}

export async function prepareInput(imageBuffer) {
  const inputBytes = imageBuffer.length;
  let pipeline = sharp(imageBuffer).rotate();

  let trimmedBuffer;
  try {
    trimmedBuffer = await pipeline.clone().trim({ threshold: 12 }).toBuffer();
  } catch {
    trimmedBuffer = await pipeline.toBuffer();
  }

  trimmedBuffer = await sharp(trimmedBuffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();

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
