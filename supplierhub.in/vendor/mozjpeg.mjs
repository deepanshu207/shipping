import { init, encode } from "./jsquash/encode.js";

const ready = init(null, {
  locateFile: (path) => new URL(`./jsquash/codec/enc/${path}`, import.meta.url).href,
});

export async function encodeImageData(imageData, options) {
  await ready;
  const buf = await encode(imageData, options);
  return new Blob([buf], { type: "image/jpeg" });
}
