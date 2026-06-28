import { generateAllVariants } from "../netlify/functions/image-optimize.js";

const input = Buffer.from(await new Promise((resolve, reject) => {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
  process.stdin.on("error", reject);
}));

const tagName = process.argv[2] || "Product";
const results = await generateAllVariants(input, tagName);
process.stdout.write(JSON.stringify(results));
