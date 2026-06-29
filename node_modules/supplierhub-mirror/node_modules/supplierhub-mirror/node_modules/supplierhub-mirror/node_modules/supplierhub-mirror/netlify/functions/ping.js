export default async () =>
  Response.json({ ok: true, api: "own", service: "ping" });

export const config = {
  path: "/api/ping",
};
