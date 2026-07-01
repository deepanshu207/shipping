import sharp from "sharp";
import { generateAllVariants } from "../netlify/functions/image-optimize.js";

/** Simulate white-bg product photo ~portrait, similar to Meesho uploads */
const sample = await sharp({
  create: { width: 1200, height: 1600, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .composite([
    {
      input: await sharp({
        create: { width: 700, height: 1100, channels: 3, background: { r: 20, g: 20, b: 25 } },
      })
        .jpeg({ quality: 95 })
        .toBuffer(),
      left: 250,
      top: 250,
    },
  ])
  .jpeg({ quality: 95 })
  .toBuffer();

console.log("Input:", Math.ceil(sample.length / 1024), "KB");
const results = await generateAllVariants(sample, "Bra");
for (const item of results) {
  console.log(`${item.fileSizeKb} KB (${item.fileSizeBytes} bytes) — ${item.tagName}`);
}
