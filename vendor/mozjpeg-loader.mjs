import { encodeImageData } from "./mozjpeg.mjs";

window.__mozEncodeReady = encodeImageData;
window.dispatchEvent(new Event("mozjpeg-ready"));
