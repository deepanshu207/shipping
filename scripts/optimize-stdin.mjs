import { generateAllVariants } from "../netlify/functions/image-optimize.js";

const input = Buffer.from(await new Promise((resolve, reject) => {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
  process.stdin.on("error", reject);
}));

const tagName = process.argv[2] || "Product";
let frameStyle = {};
if (process.argv[3]) {
  try {
    frameStyle = JSON.parse(process.argv[3]);
  } catch {
    frameStyle = {};
  }
}

const results = await generateAllVariants(input, tagName, frameStyle);
process.stdout.write(JSON.stringify(results));
