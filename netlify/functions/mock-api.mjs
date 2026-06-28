import Busboy from "busboy";
import { getStore } from "@netlify/blobs";

const GUEST_USER = {
  id: "guest-local",
  email: "guest@localhost",
  name: "Local Guest",
  credits: 999,
  role: "USER",
  picture: null,
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType =
      event.headers["content-type"] || event.headers["Content-Type"] || "";
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : Buffer.from(event.body || "", "utf8");

    const fields = {};
    const busboy = Busboy({ headers: { "content-type": contentType } });

    busboy.on("file", (name, file, info) => {
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        fields[name] = {
          filename: info.filename,
          type: info.mimeType || "image/jpeg",
          bytes: Buffer.concat(chunks),
        };
      });
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("finish", () => resolve(fields));
    busboy.on("error", reject);
    busboy.end(body);
  });
}

function mockResults(req) {
  const imageUrl = `data:${req.imageType};base64,${req.imageB64}`;
  const charges = ["38", "45", "52", "61"];
  return charges.map((charge) => ({
    shippingCharge: charge,
    imageUrl,
    tagName: req.tagName,
    lowest: charge === "38",
  }));
}

export default async (event) => {
  const route = (event.path || "").split("?")[0];
  const method = event.httpMethod;

  if (route === "/auth/me" && method === "GET") {
    return jsonResponse(200, GUEST_USER);
  }

  if (route === "/auth/logout" && method === "POST") {
    return jsonResponse(200, { ok: true });
  }

  const store = getStore("mock-requests");

  if (route === "/api/meesho/getLowestShippingCharge" && method === "POST") {
    const form = await parseMultipart(event);
    const image = form.image;
    if (!image?.bytes?.length) {
      return jsonResponse(400, { message: "Image is required" });
    }

    const requestId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const payload = {
      createdAt: Date.now(),
      tagId: form.tagId || "",
      tagName: form.tagName || "Product",
      imageType: image.type,
      imageB64: image.bytes.toString("base64"),
    };

    await store.setJSON(requestId, payload);
    return jsonResponse(200, { requestId });
  }

  if (route === "/api/meesho/fetchAllRequestId" && method === "GET") {
    const list = await store.list();
    const history = [];

    for (const item of list.blobs) {
      const req = await store.get(item.key, { type: "json" });
      if (!req) continue;
      const done = Date.now() - req.createdAt >= 5000;
      history.push({
        requestId: item.key,
        status: done ? "completed" : "processing",
        tagName: req.tagName,
        createdAt: req.createdAt,
        results: done ? mockResults(req) : [],
      });
    }

    history.sort((a, b) => b.createdAt - a.createdAt);
    return jsonResponse(200, { data: history, credits: GUEST_USER.credits });
  }

  const requestMatch = route.match(/^\/api\/meesho\/request(?:-status)?\/([^/]+)$/);
  if (requestMatch && method === "GET") {
    const requestId = requestMatch[1];
    const req = await store.get(requestId, { type: "json" });
    if (!req) {
      return jsonResponse(404, { message: "Request not found" });
    }

    if (Date.now() - req.createdAt < 5000) {
      return jsonResponse(200, { status: "processing", results: [] });
    }

    return jsonResponse(200, {
      status: "completed",
      results: mockResults(req),
    });
  }

  return jsonResponse(404, { message: "Not found" });
};
