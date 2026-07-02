import sharp from "sharp";

/** Compression logic from commit 125b98a05351ae284077bc477af05dc44cc7602d */
const MEESHO_CANVAS_SIZE = 2000;
const MEESHO_MAX_BYTES = 300 * 1024;
const MEESHO_VARIANTS = [
  { coverage: 0.62, quality: 82, label: "Tier 1 · Smallest frame (try first)" },
  { coverage: 0.65, quality: 78, label: "Tier 2 · Compact" },
  { coverage: 0.68, quality: 74, label: "Tier 3 · Balanced" },
  { coverage: 0.7, quality: 70, label: "Tier 4 · Standard Meesho size" },
];

export function kbFromBytes(bytes) {
  return Math.max(1, Math.round(bytes / 1024));
}

async function compressToTarget(buffer, quality) {
  let q = quality;
  let output = await sharp(buffer).jpeg({ quality: q, mozjpeg: true }).toBuffer();
  while (output.length > MEESHO_MAX_BYTES && q > 45) {
    q -= 5;
    output = await sharp(buffer).jpeg({ quality: q, mozjpeg: true }).toBuffer();
  }
  return output;
}

async function buildVariant(imageBuffer, variant) {
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

  const jpeg = await compressToTarget(composed, variant.quality);
  const fileSizeKb = kbFromBytes(jpeg.length);

  return {
    buffer: jpeg,
    fileSizeBytes: jpeg.length,
    fileSizeKb,
    tagName: `${variant.label} · ${fileSizeKb} KB`,
    width: MEESHO_CANVAS_SIZE,
    height: MEESHO_CANVAS_SIZE,
  };
}

export async function generateAllVariants(imageBuffer, categoryName) {
  const built = [];
  for (const variant of MEESHO_VARIANTS) {
    built.push(await buildVariant(imageBuffer, variant));
  }

  built.sort((a, b) => a.fileSizeKb - b.fileSizeKb);

  return built.map((item, index) => ({
    imageUrl: `data:image/jpeg;base64,${item.buffer.toString("base64")}`,
    tagName: item.tagName || categoryName,
    fileSizeBytes: item.fileSizeBytes,
    fileSizeKb: item.fileSizeKb,
    shippingCharge: String(item.fileSizeKb),
    width: item.width,
    height: item.height,
    lowest: index === 0,
    categoryName,
  }));
}
