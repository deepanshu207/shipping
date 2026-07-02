import sharp from "sharp";
import { generateAllVariants } from "../netlify/functions/image-optimize.js";

/** High-res indoor shot with noisy marble floor — closer to real raincoat uploads */
const w = 1200;
const h = 1800;

function noiseTile(width, height, base, spread) {
  const data = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const n = (Math.random() - 0.5) * spread;
    data[i * 3] = Math.max(0, Math.min(255, base[0] + n));
    data[i * 3 + 1] = Math.max(0, Math.min(255, base[1] + n));
    data[i * 3 + 2] = Math.max(0, Math.min(255, base[2] + n));
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
}

const floorH = Math.round(h * 0.42);
const wallH = h - floorH;
const [floor, wall] = await Promise.all([
  noiseTile(w, floorH, [55, 55, 58], 90),
  noiseTile(w, wallH, [242, 240, 235], 18),
]);

const subject = await sharp({
  create: { width: 520, height: 1280, channels: 3, background: { r: 140, g: 70, b: 200 } },
})
  .composite([
    {
      input: await sharp({
        create: { width: 520, height: 1280, channels: 3, background: { r: 255, g: 255, b: 255 } },
      })
        .png()
        .toBuffer(),
      blend: "overlay",
    },
  ])
  .modulate({ brightness: 1.05, saturation: 1.15 })
  .jpeg({ quality: 98 })
  .toBuffer();

const input = await sharp({
  create: { width: w, height: h, channels: 3, background: { r: 242, g: 240, b: 235 } },
})
  .composite([
    { input: wall, top: 0, left: 0 },
    { input: floor, top: wallH, left: 0 },
    { input: subject, top: 280, left: Math.round((w - 520) / 2) },
    {
      input: await sharp({
        create: { width: 900, height: 120, channels: 3, background: { r: 35, g: 35, b: 38 } },
      })
        .jpeg({ quality: 95 })
        .toBuffer(),
      top: wallH - 60,
      left: 150,
    },
  ])
  .jpeg({ quality: 95 })
  .toBuffer();

console.log("Input:", Math.ceil(input.length / 1024), "KB", `${w}x${h}`);
const results = await generateAllVariants(input, "Raincoat");
for (const item of results) {
  console.log(`${item.fileSizeKb} KB (${item.fileSizeBytes}b) — ${item.tagName}`);
}
