import sharp from "sharp";

export const VARIANTS = [
  { canvas: 1000, coverage: 0.58, quality: 75, label: "Tier 1 · Smallest (upload first)" },
  { canvas: 1000, coverage: 0.62, quality: 72, label: "Tier 2 · Compact 1000px" },
  { canvas: 1200, coverage: 0.62, quality: 70, label: "Tier 3 · Medium frame" },
  { canvas: 2000, coverage: 0.65, quality: 68, label: "Tier 4 · Standard Meesho" },
];

const MAX_BYTES = 180 * 1024;

export function kbFromBytes(bytes) {
  return Math.max(1, Math.ceil(bytes / 1024));
}

async function compressJpeg(buffer, startQuality) {
  let q = startQuality;
  let output = await sharp(buffer)
    .jpeg({ quality: q, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();

  while (output.length > MAX_BYTES && q > 45) {
    q -= 5;
    output = await sharp(buffer)
      .jpeg({ quality: q, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
  }

  if (output.length > MAX_BYTES) {
    output = await sharp(buffer)
      .resize(900, 900, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 60, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
  }

  return output;
}

export async function prepareInput(imageBuffer) {
  let pipeline = sharp(imageBuffer).rotate();
  const meta = await pipeline.metadata();

  try {
    const trimmed = await pipeline.clone().trim({ threshold: 15 }).toBuffer();
    pipeline = sharp(trimmed);
  } catch {
    /* skip trim if it fails */
  }

  const width = meta.width || 0;
  const height = meta.height || 0;
  if (width > 1600 || height > 1600) {
    pipeline = sharp(await pipeline.resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).toBuffer());
  }

  return pipeline.toBuffer();
}

async function buildVariant(preparedBuffer, variant) {
  const productSize = Math.round(variant.canvas * variant.coverage);

  const product = await sharp(preparedBuffer)
    .resize(productSize, productSize, { fit: "inside", withoutEnlargement: false })
    .toBuffer();

  const composed = await sharp({
    create: {
      width: variant.canvas,
      height: variant.canvas,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: product, gravity: "center" }])
    .jpeg({ quality: variant.quality, mozjpeg: true })
    .toBuffer();

  const jpeg = await compressJpeg(composed, variant.quality);
  const fileSizeBytes = jpeg.length;

  return {
    buffer: jpeg,
    fileSizeBytes,
    fileSizeKb: kbFromBytes(fileSizeBytes),
    tagName: variant.label,
  };
}

export async function generateAllVariants(imageBuffer, categoryName) {
  const prepared = await prepareInput(imageBuffer);
  const built = [];

  for (const variant of VARIANTS) {
    built.push(await buildVariant(prepared, variant));
  }

  built.sort((a, b) => a.fileSizeBytes - b.fileSizeBytes);

  return built.map((item, index) => ({
    imageUrl: `data:image/jpeg;base64,${item.buffer.toString("base64")}`,
    tagName: `${item.tagName} · ${item.fileSizeKb} KB`,
    fileSizeBytes: item.fileSizeBytes,
    fileSizeKb: item.fileSizeKb,
    shippingCharge: String(item.fileSizeKb),
    lowest: index === 0,
    categoryName,
  }));
}
