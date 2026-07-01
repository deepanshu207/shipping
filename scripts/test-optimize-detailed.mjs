import sharp from "sharp";
import { generateAllVariants } from "../netlify/functions/image-optimize.js";

/** ~90KB realistic white-bg product JPEG */
const w = 1200;
const h = 1600;
const noise = await sharp({
  create: { width: w, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .composite([
    {
      input: await sharp({
        create: { width: 700, height: 1100, channels: 3, background: { r: 15, g: 15, b: 18 } },
      })
        .modulate({ brightness: 1, saturation: 1.2 })
        .jpeg({ quality: 98 })
        .toBuffer(),
      left: 250,
      top: 250,
    },
    {
      input: await sharp({
        create: { width: 500, height: 100, channels: 3, background: { r: 200, g: 130, b: 50 } },
      })
        .jpeg({ quality: 98 })
        .toBuffer(),
      left: 350,
      top: 320,
    },
  ])
  .jpeg({ quality: 95 })
  .toBuffer();

console.log("Input:", Math.ceil(noise.length / 1024), "KB", `${w}x${h}`);
const results = await generateAllVariants(noise, "Bra");
for (const item of results) {
  console.log(`${item.fileSizeKb} KB (${item.fileSizeBytes}b) — ${item.tagName}`);
}
