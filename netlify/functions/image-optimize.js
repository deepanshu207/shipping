import sharp from "sharp";

/** SupplierDen-style output for every image — orange frame, overlays, slab KB tiers. */
const TIERS_BUSY_BG = [
  { slabKb: 91, label: "Lowest · may beat ₹93 on Meesho", lowest: true },
  { slabKb: 92, label: "Balanced" },
  { slabKb: 93, label: "Recommended · SupplierDen ₹93 match", recommended: true },
  { slabKb: 94, label: "High detail backup" },
];

const BUSY_MIN_Q = 15;
const SUPPLIERDEN_ORANGE = { r: 255, g: 121, b: 0 };
const SUPPLIERDEN_BORDER_RATIO = 0.048;
const SUPPLIERDEN_MIN_BORDER = 34;
const MEESHO_FRAMED_MAX_SIDE = 1280;

export function kbFromBytes(bytes) {
  return Math.max(1, Math.ceil(bytes / 1024));
}

function supplierDenBorderPx(w, h) {
  let border = Math.max(SUPPLIERDEN_MIN_BORDER, Math.round(Math.min(w, h) * SUPPLIERDEN_BORDER_RATIO));
  const maxSide = Math.max(w, h);
  if (maxSide + border * 2 > MEESHO_FRAMED_MAX_SIDE) {
    const capped = Math.floor((MEESHO_FRAMED_MAX_SIDE - maxSide) / 2);
    if (capped >= 28) border = capped;
  }
  return border;
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

  return { buffer: framed, width: fw, height: fh };
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

export async function prepareInput(imageBuffer) {
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

  const framed = await prepareSupplierDenBuffer(buffer, w, h);
  return { buffer: framed.buffer, width: framed.width, height: framed.height };
}

async function buildVariant(prepared, tier) {
  const jpeg = await compressBusyToSlab(prepared.buffer, tier.slabKb);
  return {
    buffer: jpeg,
    fileSizeBytes: jpeg.length,
    fileSizeKb: kbFromBytes(jpeg.length),
    tagName: `${tier.label} · ${prepared.width}×${prepared.height}`,
    recommended: !!tier.recommended,
    lowest: !!tier.lowest,
    width: prepared.width,
    height: prepared.height,
    processingPath: "supplierden",
  };
}

export async function generateAllVariants(imageBuffer, categoryName) {
  const prepared = await prepareInput(imageBuffer);
  const built = [];

  for (const tier of TIERS_BUSY_BG) {
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
