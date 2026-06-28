const Busboy = require("busboy");
const { randomBytes } = require("crypto");

const GUEST_USER = {
  id: "guest-local",
  email: "guest@localhost",
  name: "Local Guest",
  credits: 999,
  role: "USER",
  picture: null,
};

function getStore() {
  if (!globalThis.__mockRequests) {
    globalThis.__mockRequests = new Map();
  }
  return globalThis.__mockRequests;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function getRoute(event) {
  const raw =
    event.rawUrl ||
    event.headers["x-forwarded-uri"] ||
    event.headers["X-Forwarded-Uri"] ||
    event.path ||
    "";
  if (raw.startsWith("http")) {
    return new URL(raw).pathname.split("?")[0];
  }
  return raw.split("?")[0];
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType =
      event.headers["content-type"] || event.headers["Content-Type"] || "";
    const body = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64")
      : Buffer.from(event.body || "", "utf8");

    const fields = {};
    let pending = 0;
    let finished = false;

    const maybeDone = () => {
      if (finished && pending === 0) {
        resolve(fields);
      }
    };

    const busboy = Busboy({ headers: { "content-type": contentType } });

    busboy.on("file", (name, file, info) => {
      pending += 1;
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        fields[name] = {
          filename: info.filename,
          type: info.mimeType || "image/jpeg",
          bytes: Buffer.concat(chunks),
        };
        pending -= 1;
        maybeDone();
      });
      file.on("error", reject);
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("finish", () => {
      finished = true;
      maybeDone();
    });

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

exports.handler = async (event) => {
  try {
    const route = getRoute(event);
    const method = event.httpMethod;

    if (route === "/auth/me" && method === "GET") {
      return jsonResponse(200, GUEST_USER);
    }

    if (route === "/auth/logout" && method === "POST") {
      return jsonResponse(200, { ok: true });
    }

    const store = getStore();

    if (route === "/api/meesho/getLowestShippingCharge" && method === "POST") {
      const form = await parseMultipart(event);
      const image = form.image;
      if (!image?.bytes?.length) {
        return jsonResponse(400, { message: "Image is required" });
      }

      const requestId = randomBytes(6).toString("hex");
      store.set(requestId, {
        createdAt: Date.now(),
        tagId: form.tagId || "",
        tagName: form.tagName || "Product",
        imageType: image.type,
        imageB64: image.bytes.toString("base64"),
      });

      return jsonResponse(200, { requestId });
    }

    if (route === "/api/meesho/fetchAllRequestId" && method === "GET") {
      const history = [];
      for (const [requestId, req] of store.entries()) {
        const done = Date.now() - req.createdAt >= 5000;
        history.push({
          requestId,
          status: done ? "completed" : "processing",
          tagName: req.tagName,
          createdAt: req.createdAt,
          results: done ? mockResults(req) : [],
        });
      }
      history.sort((a, b) => b.createdAt - a.createdAt);
      return jsonResponse(200, { data: history, credits: GUEST_USER.credits });
    }

    const requestMatch = route.match(
      /^\/api\/meesho\/request(?:-status)?\/([^/]+)$/
    );
    if (requestMatch && method === "GET") {
      const requestId = requestMatch[1];
      const req = store.get(requestId);
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

    return jsonResponse(404, { message: "Not found", route, method });
  } catch (error) {
    console.error("mock-api error:", error);
    return jsonResponse(500, { message: error.message || "Internal error" });
  }
};
