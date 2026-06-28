import sharp from "sharp";
import { generateAllVariants } from "../netlify/functions/image-optimize.js";

const sample = await sharp({
  create: { width: 1400, height: 700, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .composite([
    {
      input: await sharp({
        create: { width: 500, height: 600, channels: 3, background: { r: 180, g: 80, b: 120 } },
      })
        .jpeg()
        .toBuffer(),
      left: 80,
      top: 50,
    },
    {
      input: await sharp({
        create: { width: 500, height: 600, channels: 3, background: { r: 160, g: 70, b: 110 } },
      })
        .jpeg()
        .toBuffer(),
      left: 650,
      top: 50,
    },
  ])
  .jpeg({ quality: 92 })
  .toBuffer();

console.log("Input:", Math.ceil(sample.length / 1024), "KB");
const results = await generateAllVariants(sample, "Test");
for (const item of results) {
  console.log(`${item.fileSizeKb} KB — ${item.tagName}`);
}
