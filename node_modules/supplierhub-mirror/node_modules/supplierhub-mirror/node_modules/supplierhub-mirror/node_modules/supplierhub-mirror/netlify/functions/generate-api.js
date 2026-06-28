import sharp from "sharp";
import { randomBytes } from "crypto";

const GUEST_USER = {
  id: "guest-local",
  email: "guest@localhost",
  name: "Local Guest",
  credits: 999,
  role: "USER",
  picture: null,
};

const VARIANTS = [
  { coverage: 0.62, quality: 82, label: "Tier 1 · Smallest frame (try first)" },
  { coverage: 0.65, quality: 78, label: "Tier 2 · Compact" },
  { coverage: 0.68, quality: 74, label: "Tier 3 · Balanced" },
  { coverage: 0.7, quality: 70, label: "Tier 4 · Standard Meesho size" },
];

function getStore() {
  if (!globalThis.__meeshoRequests) {
    globalThis.__meeshoRequests = new Map();
  }
  return globalThis.__meeshoRequests;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

async function compressToTarget(buffer, quality) {
  let q = quality;
  let output = await sharp(buffer).jpeg({ quality: q, mozjpeg: true }).toBuffer();
  while (output.length > 300 * 1024 && q > 45) {
    q -= 5;
    output = await sharp(buffer).jpeg({ quality: q, mozjpeg: true }).toBuffer();
  }
  return output;
}

async function buildVariant(imageBuffer, variant) {
  const canvasSize = 2000;
  const productSize = Math.round(canvasSize * variant.coverage);

  const product = await sharp(imageBuffer)
    .rotate()
    .resize(productSize, productSize, { fit: "inside", withoutEnlargement: false })
    .toBuffer();

  const composed = await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: product, gravity: "center" }])
    .png()
    .toBuffer();

  const jpeg = await compressToTarget(composed, variant.quality);
  const fileSizeKb = Math.round(jpeg.length / 1024);

  return {
    buffer: jpeg,
    fileSizeKb,
    tagName: `${variant.label} · ${fileSizeKb} KB`,
  };
}

async function generateAllVariants(imageBuffer, categoryName) {
  const built = [];
  for (const variant of VARIANTS) {
    built.push(await buildVariant(imageBuffer, variant));
  }

  built.sort((a, b) => a.fileSizeKb - b.fileSizeKb);

  return built.map((item, index) => ({
    imageUrl: `data:image/jpeg;base64,${item.buffer.toString("base64")}`,
    tagName: item.tagName || categoryName,
    fileSizeKb: item.fileSizeKb,
    shippingCharge: String(item.fileSizeKb),
    lowest: index === 0,
  }));
}

async function processRequest(requestId) {
  const store = getStore();
  const req = store.get(requestId);
  if (!req || req.status === "completed" || req.processing) return;

  req.processing = true;
  try {
    req.results = await generateAllVariants(req.imageBuffer, req.tagName);
    req.status = "completed";
    req.imageBuffer = null;
  } catch (error) {
    req.status = "failed";
    req.error = error.message;
  } finally {
    req.processing = false;
  }
}

export default async (request, context) => {
  try {
    const url = new URL(request.url);
    const route = url.pathname;
    const method = request.method;

    if (route === "/auth/me" && method === "GET") {
      return json(GUEST_USER);
    }

    if (route === "/auth/logout" && method === "POST") {
      return json({ ok: true });
    }

    const store = getStore();

    if (route === "/api/meesho/getLowestShippingCharge" && method === "POST") {
      const form = await request.formData();
      const image = form.get("image");
      const tagName = form.get("tagName")?.toString() || "Product";

      if (!image || typeof image === "string") {
        return json({ message: "Image is required" }, 400);
      }

      const imageBuffer = Buffer.from(await image.arrayBuffer());
      if (!imageBuffer.length) {
        return json({ message: "Image is required" }, 400);
      }

      const requestId = randomBytes(6).toString("hex");
      store.set(requestId, {
        createdAt: Date.now(),
        tagName,
        tagId: form.get("tagId")?.toString() || "",
        imageBuffer,
        status: "processing",
        results: [],
        processing: false,
      });

      if (context?.waitUntil) {
        context.waitUntil(processRequest(requestId));
      } else {
        await processRequest(requestId);
      }

      return json({ requestId });
    }

    if (route === "/api/meesho/fetchAllRequestId" && method === "GET") {
      const history = [];
      for (const [requestId, req] of store.entries()) {
        const done = req.status === "completed";
        history.push({
          requestId,
          status: done ? "completed" : req.status === "failed" ? "failed" : "processing",
          tagName: req.tagName,
          createdAt: req.createdAt,
          results: done ? req.results : [],
        });
      }
      history.sort((a, b) => b.createdAt - a.createdAt);
      return json({ data: history, credits: GUEST_USER.credits });
    }

    const requestMatch = route.match(/^\/api\/meesho\/request(?:-status)?\/([^/]+)$/);
    if (requestMatch && method === "GET") {
      const requestId = requestMatch[1];
      const req = store.get(requestId);

      if (!req) {
        return json({ message: "Request not found" }, 404);
      }

      if (req.status !== "completed" && !req.processing) {
        await processRequest(requestId);
      }

      if (req.status === "failed") {
        return json({ status: "failed", results: [] });
      }

      if (Date.now() - req.createdAt < 4000 || req.status !== "completed") {
        return json({ status: "processing", results: [] });
      }

      return json({ status: "completed", results: req.results || [] });
    }

    return json({ message: "Not found", route, method }, 404);
  } catch (error) {
    console.error("generate-api error:", error);
    return json({ message: error.message || "Internal error" }, 500);
  }
};
