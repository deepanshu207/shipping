/**
 * Server/sharp path — raincoat tag must not fall through to 91–93 KB framed_classic.
 */
import { generateAllVariants } from "../netlify/functions/image-optimize.js";
import sharp from "sharp";

const w = 1200;
const h = 1800;
const channels = [];
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const floor = y > h * 0.65;
    const r = floor ? 90 + (x % 40) : 238 + (x % 8);
    const g = floor ? 88 + (y % 35) : 236 + (y % 6);
    const b = floor ? 92 + ((x * y) % 30) : 232 + ((x + y) % 5);
    channels.push(r, g, b);
  }
}
const sample = await sharp(Buffer.from(channels), {
  raw: { width: w, height: h, channels: 3 },
})
  .jpeg({ quality: 95 })
  .toBuffer();

const tag = "Raincoat indoor busy lowest shipping framed";
const results = await generateAllVariants(sample, tag, {
  frameBorderColor: "#FF7900",
  frameStickerTemplate: "classic_promo",
});

const inrs = results.map((r) => Number(r.estimatedShippingInr || r.shippingCharge || 0));
const bytes = results.map((r) => r.fileSizeBytes || 0);
const paths = [...new Set(results.map((r) => r.processingPath))];
const maxSides = results.map((r) => Math.max(r.width || 0, r.height || 0));
const isSquare1024 = results.some((r) => r.width === 1024 && r.height === 1024);

const ok =
  results.length >= 20 &&
  results.length <= 30 &&
  paths.includes("raincoat_framed") &&
  !paths.includes("framed_classic") &&
  inrs.every((n) => n <= 66) &&
  bytes.every((b) => b <= 68 * 1024) &&
  maxSides.every((n) => n <= 1024) &&
  isSquare1024;

if (!ok) {
  console.error("FAIL", {
    count: results.length,
    paths,
    minInr: Math.min(...inrs),
    maxInr: Math.max(...inrs),
    maxBytes: Math.max(...bytes),
    maxSide: Math.max(...maxSides),
    isSquare1024,
    bestDims: `${results[0]?.width}×${results[0]?.height}`,
    best: results[0],
  });
  process.exit(1);
}

console.log(
  "OK",
  JSON.stringify({
    count: results.length,
    paths,
    minInr: Math.min(...inrs),
    maxInr: Math.max(...inrs),
    maxBytes: Math.max(...bytes),
    maxSide: Math.max(...maxSides),
    isSquare1024,
    bestDims: `${results[0]?.width}×${results[0]?.height}`,
  })
);
