import sharp from "sharp";
import { parseFrameStyle, hexToRgb, normalizeStickerTemplate, defaultFrameStyle } from "./frame-style.js";

const TIERS_BUSY_BG = [
  { slabKb: 91, label: "Lowest · may beat ₹93 on Meesho", lowest: true },
  { slabKb: 92, label: "Balanced" },
  { slabKb: 93, label: "Recommended · ₹93 framed match", recommended: true },
  { slabKb: 94, label: "High detail backup" },
];

const TIERS_WHITE_BG = [
  { targetKb: 20, label: "Smallest file · verify ₹ on Meesho", lowest: true },
  { targetKb: 22, label: "Recommended · white studio", recommended: true },
  { targetKb: 24, label: "Standard" },
  { targetKb: 26, label: "High detail" },
];

const TIERS_STUDIO_ULTRA = [
  { targetKb: 16, label: "Ultra minimum · verify ₹ on Meesho", lowest: true },
  { targetKb: 18, label: "Recommended · lowest studio", recommended: true },
  { targetKb: 20, label: "Standard ultra" },
  { targetKb: 22, label: "High detail backup" },
];

const TIERS_STUDIO_BALANCED = [
  { targetKb: 20, label: "₹20 range · full size display", lowest: true },
  { targetKb: 24, label: "Recommended · ₹20–40 on Meesho", recommended: true },
  { targetKb: 28, label: "Standard" },
  { targetKb: 32, label: "High detail backup" },
];

const TIERS_FRAMED_LOW = [
  { slabKb: 64, label: "Lowest · try on Meesho first", lowest: true },
  { slabKb: 66, label: "Recommended · ₹66 slab", recommended: true },
  { slabKb: 68, label: "Balanced" },
  { slabKb: 71, label: "₹71 backup" },
];

const TIERS_FRAMED_PRO = [
  { slabKb: 177, label: "Large file ~177 KB", lowest: true },
  { slabKb: 185, label: "Recommended · large file low ₹", recommended: true },
  { slabKb: 193, label: "Standard large framed" },
  { slabKb: 200, label: "High detail · pro framed match" },
];

const TIERS_SUPPLIERDEN_50 = [
  { slabKb: 48, label: "Lowest · SupplierDen ₹50 target", lowest: true },
  { slabKb: 50, label: "Recommended · ₹50 match", recommended: true },
  { slabKb: 52, label: "Balanced" },
  { slabKb: 55, label: "High detail backup" },
];

const TIERS_SUPPLIERDEN_TALL = [
  { slabKb: 44, label: "44KB · lowest try", lowest: true },
  { slabKb: 46, label: "46KB · low band" },
  { slabKb: 48, label: "48KB · ₹50 target", recommended: true },
  { slabKb: 49, label: "49KB" },
  { slabKb: 50, label: "50KB · match", recommended: true },
  { slabKb: 51, label: "51KB" },
  { slabKb: 52, label: "52KB" },
];

const RAINCOAT_KB_TIERS = [
  { slabKb: 58, label: "58KB · low band", lowest: true },
  { slabKb: 60, label: "60KB · target" },
  { slabKb: 61, label: "61KB" },
  { slabKb: 62, label: "62KB" },
  { slabKb: 63, label: "63KB · ₹63 match", recommended: true },
  { slabKb: 64, label: "64KB" },
  { slabKb: 65, label: "65KB" },
  { slabKb: 66, label: "66KB · backup" },
];

const RAINCOAT_DEFAULT_OLIVE = "#556B2F";

const RAINCOAT_LAYOUTS = [
  {
    layout: "rc_p1024",
    type: "indoor_framed",
    framedMaxSide: 1024,
    priority: 0,
    panelTag: "portrait framed 1024 · promo",
    tiers: RAINCOAT_KB_TIERS,
  },
];

const SUPPLIERDEN_TALL_LAYOUTS = [
  {
    layout: "sd_exact703",
    outerW: 703,
    outerH: 1024,
    borderPx: 10,
    topMarginRatio: 0.15,
    bottomMarginRatio: 0.05,
    sideMarginRatio: 0.1,
    priority: 0,
    panelTag: "exact 703×1024 · SupplierDen match",
    tiers: TIERS_SUPPLIERDEN_TALL,
  },
  {
    layout: "sd_exact703_tight",
    outerW: 703,
    outerH: 1024,
    borderPx: 10,
    topMarginRatio: 0.12,
    bottomMarginRatio: 0.04,
    sideMarginRatio: 0.08,
    priority: 1,
    panelTag: "exact 703×1024 · tight fill",
    tiers: TIERS_SUPPLIERDEN_TALL,
  },
  {
    layout: "sd_exact703_loose",
    outerW: 703,
    outerH: 1024,
    borderPx: 10,
    topMarginRatio: 0.18,
    bottomMarginRatio: 0.06,
    sideMarginRatio: 0.12,
    priority: 2,
    panelTag: "exact 703×1024 · loose fill",
    tiers: TIERS_SUPPLIERDEN_TALL,
  },
  {
    layout: "sd_exact680",
    outerW: 680,
    outerH: 990,
    borderPx: 10,
    topMarginRatio: 0.15,
    bottomMarginRatio: 0.05,
    sideMarginRatio: 0.1,
    priority: 5,
    panelTag: "exact 680×990",
    tiers: TIERS_SUPPLIERDEN_TALL,
  },
  {
    layout: "sd_exact640",
    outerW: 640,
    outerH: 960,
    borderPx: 10,
    topMarginRatio: 0.15,
    bottomMarginRatio: 0.05,
    sideMarginRatio: 0.1,
    priority: 7,
    panelTag: "exact 640×960",
    tiers: TIERS_SUPPLIERDEN_TALL,
  },
];

const SUPPLIERDEN_MATCH_PURPLE = "#7C3AED";

const FRAME_BORDER_RATIO = 0.048;
const FRAME_MIN_BORDER = 34;
const MEESHO_FRAMED_DIM_CAP_PATHS = new Set([
  "framed_classic",
  "framed_pro",
  "framed_low",
  "framed_compact",
  "supplierden",
  "supplierden_heavy",
  "supplierden_match_50",
]);
const WHITE_TOL = 42;
const WHITE_BG_THRESHOLD = 0.62;
const ABS_MIN_Q = 18;
const BUSY_MIN_Q = 15;
const MEESHO_FRAMED_MAX_SIDE = 1280;
const OVERLAY_SUPERSAMPLE = 2;

const STUDIO_CATEGORY_RE =
  /\b(bra|bras|lingerie|panty|panties|underwear|bikini|sports bra|feeding bra|shapewear|camisole|nighty|nightwear|blouse|petticoat)\b/i;
const INDOOR_CATEGORY_RE = /\b(raincoat|rain coat|rainwear|men raincoat)\b/i;

function framedBorderPx(w, h, framedMaxSide = MEESHO_FRAMED_MAX_SIDE) {
  let border = Math.max(FRAME_MIN_BORDER, Math.round(Math.min(w, h) * FRAME_BORDER_RATIO));
  const maxSide = Math.max(w, h);
  if (maxSide + border * 2 > framedMaxSide) {
    const capped = Math.floor((framedMaxSide - maxSide) / 2);
    if (capped >= 28) border = capped;
  }
  return border;
}

function framedOuterMaxSide(w, h, framedMaxSide = MEESHO_FRAMED_MAX_SIDE) {
  return Math.max(w, h) + framedBorderPx(w, h, framedMaxSide) * 2;
}

/** Proportional downscale — framed max side ≤ cap (Meesho shipping tier). */
function fitFramedPhotoDims(w, h, framedMaxSide = MEESHO_FRAMED_MAX_SIDE) {
  let nw = w;
  let nh = h;
  const max0 = Math.max(nw, nh);
  if (max0 > 2000) {
    const scale = 2000 / max0;
    nw = Math.round(nw * scale);
    nh = Math.round(nh * scale);
  }
  for (let i = 0; i < 12 && framedOuterMaxSide(nw, nh, framedMaxSide) > framedMaxSide; i++) {
    const framed = framedOuterMaxSide(nw, nh, framedMaxSide);
    const scale = (framedMaxSide - 1) / framed;
    nw = Math.max(1, Math.round(nw * scale));
    nh = Math.max(1, Math.round(nh * scale));
  }
  return { w: nw, h: nh };
}

function specialOfferSvg(scale) {
  const w = 92 * scale;
  const h = 54 * scale;
  const pad = 8 * scale;
  const bw = w + pad * 2;
  const bh = h + pad * 2;
  const font = 12.5 * scale;
  const ss = OVERLAY_SUPERSAMPLE;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bw * ss)}" height="${Math.ceil(bh * ss)}" viewBox="0 0 ${Math.ceil(bw)} ${Math.ceil(bh)}">
    <g transform="translate(${pad},${pad}) rotate(-8 ${w / 2} ${h / 2})">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${7 * scale}" fill="#D32F2F" stroke="#FFD600" stroke-width="${3 * scale}"/>
      <text x="${w / 2}" y="${h * 0.34}" fill="#FFD600" stroke="#B71C1C" stroke-width="${0.55 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle" dominant-baseline="middle">SPECIAL</text>
      <text x="${w / 2}" y="${h * 0.72}" fill="#FFD600" stroke="#B71C1C" stroke-width="${0.55 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle" dominant-baseline="middle">OFFER</text>
    </g>
  </svg>`);
}

function hotSaleSvg(scale) {
  const outer = 78 * scale;
  const pad = 14 * scale;
  const size = outer * 2 + pad * 2;
  const center = size / 2;
  const spikes = 14;
  let points = "";
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    const radius = i % 2 === 0 ? outer : 34 * scale;
    const px = center + Math.cos(angle) * radius;
    const py = center + Math.sin(angle) * radius;
    points += `${px},${py} `;
  }
  const ss = OVERLAY_SUPERSAMPLE;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size * ss)}" height="${Math.ceil(size * ss)}" viewBox="0 0 ${Math.ceil(size)} ${Math.ceil(size)}">
    <polygon points="${points.trim()}" fill="url(#burst)" stroke="#B71C1C" stroke-width="${2.4 * scale}"/>
    <defs>
      <radialGradient id="burst">
        <stop offset="0%" stop-color="#FFEB3B"/>
        <stop offset="55%" stop-color="#FF9800"/>
        <stop offset="100%" stop-color="#E53935"/>
      </radialGradient>
    </defs>
    <text x="${center}" y="${center - 14 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.5 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${15 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">HOT</text>
    <text x="${center}" y="${center + 4 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.45 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${13 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">SALE</text>
    <text x="${center}" y="${center + 22 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.6 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${12 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">BIG SALE</text>
  </svg>`);
}

function megaSaleSvg(scale) {
  const w = 118 * scale;
  const h = 58 * scale;
  const font = 14 * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${8 * scale}" fill="#D32F2F" stroke="#FFEB3B" stroke-width="${3 * scale}"/>
    <text x="${w / 2}" y="${h * 0.35}" fill="#FFEB3B" stroke="#B71C1C" stroke-width="${0.6 * scale}" paint-order="stroke fill" font-family="Arial,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle">MEGA</text>
    <text x="${w / 2}" y="${h * 0.72}" fill="#FFFFFF" stroke="#B71C1C" stroke-width="${0.6 * scale}" paint-order="stroke fill" font-family="Arial,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle">SALE</text>
  </svg>`);
}

function bestPriceSvg(scale) {
  const w = 130 * scale;
  const h = 34 * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#C62828" stroke="#FFD600" stroke-width="${2 * scale}"/>
    <text x="${w / 2}" y="${h / 2}" fill="#FFD600" stroke="#7F0000" stroke-width="${1 * scale}" paint-order="stroke fill" font-family="Arial,sans-serif" font-size="${13 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">BEST PRICE</text>
  </svg>`);
}

function limitedTimeSvg(scale) {
  const w = 108 * scale;
  const h = 48 * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${8 * scale}" fill="#4527A0" stroke="#FFD600" stroke-width="${2.5 * scale}"/>
    <text x="${w / 2}" y="${h * 0.36}" fill="#FFD600" font-family="Arial,sans-serif" font-size="${11 * scale}" font-weight="900" text-anchor="middle">LIMITED</text>
    <text x="${w / 2}" y="${h * 0.72}" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="${11 * scale}" font-weight="900" text-anchor="middle">TIME</text>
  </svg>`);
}

function flashDealSvg(scale) {
  const outer = 72 * scale;
  const pad = 12 * scale;
  const size = outer * 2 + pad * 2;
  const center = size / 2;
  const spikes = 12;
  let points = "";
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    const radius = i % 2 === 0 ? outer : 30 * scale;
    const px = center + Math.cos(angle) * radius;
    const py = center + Math.sin(angle) * radius;
    points += `${px},${py} `;
  }
  const ss = OVERLAY_SUPERSAMPLE;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size * ss)}" height="${Math.ceil(size * ss)}" viewBox="0 0 ${Math.ceil(size)} ${Math.ceil(size)}">
    <polygon points="${points.trim()}" fill="url(#flash)" stroke="#BF360C" stroke-width="${2.2 * scale}"/>
    <defs><radialGradient id="flash"><stop offset="0%" stop-color="#FFEE58"/><stop offset="60%" stop-color="#FF7043"/><stop offset="100%" stop-color="#D84315"/></radialGradient></defs>
    <text x="${center}" y="${center - 8 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.4 * scale}" paint-order="stroke fill" font-family="Arial,sans-serif" font-size="${12 * scale}" font-weight="900" text-anchor="middle">FLASH</text>
    <text x="${center}" y="${center + 10 * scale}" fill="#FFFFFF" stroke="#7F0000" stroke-width="${1.4 * scale}" paint-order="stroke fill" font-family="Arial,sans-serif" font-size="${12 * scale}" font-weight="900" text-anchor="middle">DEAL</text>
  </svg>`);
}

function superOfferSvg(scale) {
  const w = 96 * scale;
  const h = 50 * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${7 * scale}" fill="#00897B" stroke="#FFD600" stroke-width="${2.5 * scale}"/>
    <text x="${w / 2}" y="${h * 0.34}" fill="#FFD600" font-family="Arial,sans-serif" font-size="${12 * scale}" font-weight="900" text-anchor="middle">SUPER</text>
    <text x="${w / 2}" y="${h * 0.72}" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="${12 * scale}" font-weight="900" text-anchor="middle">OFFER</text>
  </svg>`);
}

function flatOffSvg(scale) {
  const d = 72 * scale;
  const r = d / 2 - 2 * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(d)}" height="${Math.ceil(d)}" viewBox="0 0 ${Math.ceil(d)} ${Math.ceil(d)}">
    <circle cx="${d / 2}" cy="${d / 2}" r="${r}" fill="#F57C00" stroke="#FFFFFF" stroke-width="${2.5 * scale}"/>
    <text x="${d / 2}" y="${d / 2 - 4 * scale}" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="${16 * scale}" font-weight="900" text-anchor="middle">50%</text>
    <text x="${d / 2}" y="${d / 2 + 12 * scale}" fill="#FFEB3B" font-family="Arial,sans-serif" font-size="${11 * scale}" font-weight="900" text-anchor="middle">OFF</text>
  </svg>`);
}

function freeDeliverySvg(scale) {
  const truckW = 54 * scale;
  const truckH = 34 * scale;
  const textW = 92 * scale;
  const textH = 52 * scale;
  const gap = 6 * scale;
  const pad = 10 * scale;
  const bw = truckW + gap + textW + pad * 2;
  const bh = Math.max(truckH, textH) + pad * 2;
  const truckY = (bh - pad * 2 - truckH) / 2;
  const boxX = truckW + gap + pad;
  const boxY = (bh - pad * 2 - textH) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bw)}" height="${Math.ceil(bh)}" viewBox="0 0 ${Math.ceil(bw)} ${Math.ceil(bh)}">
    <rect x="${pad}" y="${pad + truckY + truckH * 0.42}" width="${truckW * 0.72}" height="${truckH * 0.34}" rx="${3 * scale}" fill="#D32F2F"/>
    <rect x="${pad + truckW * 0.08}" y="${pad + truckY + truckH * 0.18}" width="${truckW * 0.52}" height="${truckH * 0.42}" rx="${4 * scale}" fill="#D32F2F"/>
    <circle cx="${pad + truckW * 0.2}" cy="${pad + truckY + truckH * 0.82}" r="${5 * scale}" fill="#FFFFFF"/>
    <circle cx="${pad + truckW * 0.58}" cy="${pad + truckY + truckH * 0.82}" r="${5 * scale}" fill="#FFFFFF"/>
    <rect x="${boxX}" y="${pad + boxY}" width="${textW}" height="${textH}" rx="${8 * scale}" fill="#FFFFFF" stroke="#111827" stroke-width="${2.2 * scale}"/>
    <text x="${boxX + textW / 2}" y="${pad + boxY + textH * 0.38}" fill="#111827" font-family="Arial,sans-serif" font-size="${18 * scale}" font-weight="900" text-anchor="middle">FREE</text>
    <text x="${boxX + textW / 2}" y="${pad + boxY + textH * 0.72}" fill="#111827" font-family="Arial,sans-serif" font-size="${11 * scale}" font-weight="800" text-anchor="middle">DELIVERY</text>
  </svg>`);
}

function bestChoiceOfferSvg(scale) {
  const d = 96 * scale;
  const pad = 10 * scale;
  const size = d + pad * 2;
  const center = size / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size)}" height="${Math.ceil(size)}" viewBox="0 0 ${Math.ceil(size)} ${Math.ceil(size)}">
    <defs><radialGradient id="bco"><stop offset="0%" stop-color="#FF7043"/><stop offset="55%" stop-color="#7B1FA2"/><stop offset="100%" stop-color="#4A148C"/></radialGradient></defs>
    <circle cx="${center}" cy="${center}" r="${d / 2}" fill="url(#bco)" stroke="#FFD600" stroke-width="${2.5 * scale}"/>
    <rect x="${center - d * 0.42}" y="${center - d * 0.3}" width="${d * 0.84}" height="${d * 0.24}" rx="${5 * scale}" fill="#2E7D32" stroke="#A5D6A7" stroke-width="${1.5 * scale}" transform="rotate(-5 ${center} ${center - d * 0.18})"/>
    <text x="${center}" y="${center - d * 0.18}" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="${9.5 * scale}" font-weight="900" text-anchor="middle">BEST CHOICE</text>
    <text x="${center}" y="${center + d * 0.16}" fill="#FFD600" font-family="Arial,sans-serif" font-size="${12 * scale}" font-weight="900" text-anchor="middle">OFFER</text>
  </svg>`);
}

function specialOfferBurstSvg(scale) {
  const outer = 78 * scale;
  const pad = 14 * scale;
  const size = outer * 2 + pad * 2;
  const center = size / 2;
  const spikes = 14;
  let points = "";
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    const radius = i % 2 === 0 ? outer : 34 * scale;
    const px = center + Math.cos(angle) * radius;
    const py = center + Math.sin(angle) * radius;
    points += `${px},${py} `;
  }
  const ss = OVERLAY_SUPERSAMPLE;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size * ss)}" height="${Math.ceil(size * ss)}" viewBox="0 0 ${Math.ceil(size)} ${Math.ceil(size)}">
    <polygon points="${points.trim()}" fill="url(#sob)" stroke="#B71C1C" stroke-width="${2.4 * scale}"/>
    <defs>
      <radialGradient id="sob">
        <stop offset="0%" stop-color="#FFEB3B"/>
        <stop offset="55%" stop-color="#FF9800"/>
        <stop offset="100%" stop-color="#E53935"/>
      </radialGradient>
    </defs>
    <text x="${center}" y="${center - 10 * scale}" fill="#FFFFFF" stroke="#B71C1C" stroke-width="${1.6 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${14 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">SPECIAL</text>
    <text x="${center}" y="${center + 10 * scale}" fill="#FFFFFF" stroke="#B71C1C" stroke-width="${1.5 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${13 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">OFFER</text>
  </svg>`);
}

function specialSaleSvg(scale) {
  const spikes = 12;
  const outer = 72 * scale;
  const inner = 30 * scale;
  const pad = 12 * scale;
  const size = outer * 2 + pad * 2;
  const center = size / 2;
  let points = "";
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    const radius = i % 2 === 0 ? outer : inner;
    const px = center + Math.cos(angle) * radius;
    const py = center + Math.sin(angle) * radius;
    points += `${px},${py} `;
  }
  const ss = OVERLAY_SUPERSAMPLE;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size * ss)}" height="${Math.ceil(size * ss)}" viewBox="0 0 ${Math.ceil(size)} ${Math.ceil(size)}">
    <polygon points="${points.trim()}" fill="url(#ssb)" stroke="#111827" stroke-width="${2.6 * scale}"/>
    <defs>
      <radialGradient id="ssb">
        <stop offset="0%" stop-color="#FFF59D"/>
        <stop offset="55%" stop-color="#FFEB3B"/>
        <stop offset="100%" stop-color="#FFC107"/>
      </radialGradient>
    </defs>
    <text x="${center}" y="${center - 9 * scale}" fill="#111827" stroke="#FFFFFF" stroke-width="${1.1 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${12.5 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">SPECIAL</text>
    <text x="${center}" y="${center + 9 * scale}" fill="#111827" stroke="#FFFFFF" stroke-width="${1.15 * scale}" paint-order="stroke fill" font-family="Arial,Helvetica,sans-serif" font-size="${13 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">SALE</text>
  </svg>`);
}

function bestSellerSealSvg(scale) {
  const d = 96 * scale;
  const pad = 10 * scale;
  const size = d + pad * 2;
  const center = size / 2;
  const ribbonW = d * 0.34;
  const ribbonH = 22 * scale;
  const ribbonY = center + d / 2 - 2 * scale;
  const totalH = size + 28 * scale;
  const ss = OVERLAY_SUPERSAMPLE;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size * ss)}" height="${Math.ceil(totalH * ss)}" viewBox="0 0 ${Math.ceil(size)} ${Math.ceil(totalH)}">
    <defs><radialGradient id="bss"><stop offset="0%" stop-color="#FFE082"/><stop offset="45%" stop-color="#FFC107"/><stop offset="100%" stop-color="#FF8F00"/></radialGradient></defs>
    <circle cx="${center}" cy="${center}" r="${d / 2}" fill="url(#bss)" stroke="#F57F17" stroke-width="${2.8 * scale}"/>
    <text x="${center}" y="${center - d * 0.08}" fill="#4E342E" font-family="Arial,Helvetica,sans-serif" font-size="${11 * scale}" font-weight="900" text-anchor="middle" dominant-baseline="middle">Best Seller</text>
    <text x="${center}" y="${center + d * 0.2}" fill="#4E342E" font-family="Arial,Helvetica,sans-serif" font-size="${8.5 * scale}" font-weight="800" text-anchor="middle" dominant-baseline="middle">TOP QUALITY</text>
    <rect x="${center - ribbonW / 2}" y="${ribbonY}" width="${ribbonW}" height="${ribbonH}" rx="${3 * scale}" fill="#1A237E"/>
    <polygon points="${center - ribbonW / 2},${ribbonY + ribbonH} ${center - ribbonW / 2 + 8 * scale},${ribbonY + ribbonH + 10 * scale} ${center - ribbonW / 2 + 16 * scale},${ribbonY + ribbonH}" fill="#283593"/>
    <polygon points="${center + ribbonW / 2},${ribbonY + ribbonH} ${center + ribbonW / 2 - 8 * scale},${ribbonY + ribbonH + 10 * scale} ${center + ribbonW / 2 - 16 * scale},${ribbonY + ribbonH}" fill="#283593"/>
  </svg>`);
}

function stickerCompositesForTemplate(templateId, border, width, height) {
  const scale = Math.max(0.78, Math.min(1.35, Math.min(width, height) / 900));
  const burstScale = scale * 1.05;
  const template = normalizeStickerTemplate(templateId);
  const composites = [];
  if (template === "none") return composites;

  const offerLeft = Math.round(border + width * 0.66);
  const offerTop = Math.round(border + height * 0.05);
  const burstLeft = Math.round(border + width * 0.16 - (78 * burstScale * 2 + 28 * burstScale) / 2);
  const burstTop = Math.round(border + height * 0.72 - (78 * burstScale * 2 + 28 * burstScale) / 2);
  const burstSize = 78 * burstScale * 2 + 28 * burstScale;

  if (template === "classic_promo") {
    composites.push({ input: specialOfferSvg(scale), left: offerLeft, top: offerTop });
    composites.push({ input: hotSaleSvg(burstScale), left: burstLeft, top: burstTop });
  } else if (template === "mega_sale") {
    composites.push({ input: megaSaleSvg(scale * 1.08), left: Math.round(border + width * 0.62), top: offerTop });
  } else if (template === "best_price") {
    composites.push({ input: bestPriceSvg(scale), left: border + Math.round(width * 0.02), top: border + Math.round(height * 0.02) });
    composites.push({
      input: hotSaleSvg(scale * 0.85),
      left: Math.round(border + width * 0.78 - burstSize / 2),
      top: Math.round(border + height * 0.68 - burstSize / 2),
    });
  } else if (template === "limited_time") {
    composites.push({ input: limitedTimeSvg(scale), left: Math.round(border + width * 0.58), top: offerTop });
    composites.push({ input: flashDealSvg(scale * 0.75), left: burstLeft, top: burstTop });
  } else if (template === "flash_deal") {
    composites.push({ input: flashDealSvg(scale * 1.05), left: burstLeft, top: burstTop });
    composites.push({ input: specialOfferSvg(scale * 0.92), left: offerLeft, top: offerTop });
  } else if (template === "super_offer") {
    composites.push({ input: superOfferSvg(scale), left: offerLeft, top: offerTop });
    composites.push({
      input: flatOffSvg(scale * 0.95),
      left: Math.round(border + width * 0.1 - 72 * scale * 0.95 / 2),
      top: Math.round(border + height * 0.72 - 72 * scale * 0.95 / 2),
    });
  } else if (template === "supplierden_match") {
    const delivery = freeDeliverySvg(scale);
    const badge = bestChoiceOfferSvg(scale * 0.95);
    const deliveryH = Math.max(34 * scale, 52 * scale) + 20 * scale;
    const badgeSize = 96 * scale * 0.95 + 20 * scale;
    composites.push({
      input: delivery,
      left: Math.round(border + width * 0.04),
      top: Math.round(border + height * 0.42 - deliveryH / 2),
    });
    composites.push({
      input: badge,
      left: Math.round(border + width * 0.5 - badgeSize / 2),
      top: Math.round(border + height * 0.38 - badgeSize / 2),
    });
  } else if (template === "supplierden_one") {
    const delivery = freeDeliverySvg(scale);
    const deliveryH = Math.max(34 * scale, 52 * scale) + 20 * scale;
    composites.push({
      input: delivery,
      left: Math.round(border + width * 0.04),
      top: Math.round(border + height * 0.42 - deliveryH / 2),
    });
  } else if (template === "raincoat_promo") {
    const burst = specialOfferBurstSvg(scale);
    const sale = specialSaleSvg(scale);
    const seal = bestSellerSealSvg(scale);
    const burstSize = 78 * scale * 2 + 28 * scale;
    const saleSize = 72 * scale * 2 + 24 * scale;
    const sealSize = 96 * scale + 20 * scale;
    composites.push({
      input: burst,
      left: Math.round(border + width * 0.5 - burstSize / 2),
      top: Math.round(border + height * 0.1 - burstSize / 2),
    });
    composites.push({
      input: sale,
      left: Math.round(border + width * 0.24 - saleSize / 2),
      top: Math.round(border + height * 0.74 - saleSize / 2),
    });
    composites.push({
      input: seal,
      left: Math.round(border + width * 0.78 - sealSize / 2),
      top: Math.round(border + height * 0.78 - sealSize / 2),
    });
  } else {
    composites.push({ input: specialOfferSvg(scale), left: offerLeft, top: offerTop });
    composites.push({ input: hotSaleSvg(burstScale), left: burstLeft, top: burstTop });
  }

  return composites;
}

async function prepareFramedBuffer(buffer, width, height, framedMaxSide = MEESHO_FRAMED_MAX_SIDE, frameStyleInput) {
  const style = parseFrameStyle(frameStyleInput || {});
  const border = framedBorderPx(width, height, framedMaxSide);
  const fw = width + border * 2;
  const fh = height + border * 2;
  const bg = hexToRgb(style.borderColor);
  const composites = [{ input: buffer, left: border, top: border }];
  composites.push(...stickerCompositesForTemplate(style.stickerTemplate, border, width, height));

  const framed = await sharp({
    create: { width: fw, height: fh, channels: 3, background: bg },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return { buffer: framed, width: fw, height: fh, whiteRatio: 0 };
}

function tiersForWhite(whiteRatio) {
  return whiteRatio >= WHITE_BG_THRESHOLD ? TIERS_WHITE_BG : TIERS_BUSY_BG;
}

export function kbFromBytes(bytes) {
  return Math.max(1, Math.ceil(bytes / 1024));
}

function estimateMeeshoInr(item) {
  const fileKb = kbFromBytes(item.fileSizeBytes);
  const maxSide = Math.max(item.width || 0, item.height || 0);
  const path = item.processingPath || "";
  if (path === "supplierden_match_50") {
    if (maxSide > 0 && maxSide <= 1024 && fileKb >= 37 && fileKb <= 55) return Math.min(fileKb, 50);
    if (maxSide > 1024 && maxSide <= MEESHO_FRAMED_MAX_SIDE) return Math.min(fileKb, 79);
    return Math.min(fileKb, 50);
  }
  if (path === "raincoat_framed") {
    const w = item.width || 0;
    const h = item.height || 0;
    if (h > w && maxSide > 0 && maxSide <= 1024 && fileKb >= 58 && fileKb <= 66) return fileKb;
    if (w === 1024 && h === 1024 && fileKb >= 58 && fileKb <= 66) return fileKb;
    if (w === h && maxSide <= 1024 && fileKb <= 68) return fileKb;
    if (fileKb <= 68) return fileKb;
    if (maxSide > 0 && maxSide <= MEESHO_FRAMED_MAX_SIDE) return Math.min(fileKb, 66);
    return Math.min(fileKb, 66);
  }
  if (MEESHO_FRAMED_DIM_CAP_PATHS.has(path) && maxSide > 0 && maxSide <= MEESHO_FRAMED_MAX_SIDE) {
    return Math.min(fileKb, 93);
  }
  return fileKb;
}

function isRaincoatTagName(tagName) {
  const tag = String(tagName || "").toLowerCase();
  return INDOOR_CATEGORY_RE.test(tag) || tag.includes("raincoat") || tag.includes("rain coat");
}

function isRaincoatLowestTagName(tagName) {
  const tag = String(tagName || "").toLowerCase();
  return (
    isRaincoatTagName(tagName) ||
    tag.includes("raincoat lowest") ||
    tag.includes("raincoat indoor lowest") ||
    (tag.includes("raincoat") && tag.includes("lowest")) ||
    (INDOOR_CATEGORY_RE.test(tag) && tag.includes("lowest"))
  );
}

function resolveRaincoatFrameStyle(frameStyleInput) {
  const user = parseFrameStyle(frameStyleInput || {});
  return {
    borderColor: user.borderColor || RAINCOAT_DEFAULT_OLIVE,
    stickerTemplate: user.stickerTemplate || "raincoat_promo",
  };
}

function isSupplierDenOneStickerTagName(tagName) {
  const tag = String(tagName || "").toLowerCase();
  return tag.includes("one sticker") || tag.includes("1 sticker");
}

function isSupplierDenTagName(tagName) {
  const tag = String(tagName || "").toLowerCase();
  return (
    isSupplierDenOneStickerTagName(tagName) ||
    tag.includes("supplierden match") ||
    tag.includes("supplierden ₹50") ||
    tag.includes("supplierden 50") ||
    tag.includes("supplierden lowest") ||
    (tag.includes("tall dress") && tag.includes("₹50"))
  );
}

async function prepareSupplierDenExactBuffer(imageBuffer, spec, frameStyleInput) {
  const outerW = spec.outerW ?? 703;
  const outerH = spec.outerH ?? 1024;
  const border = spec.borderPx ?? 10;
  const margins = {
    top: spec.topMarginRatio ?? 0.15,
    bottom: spec.bottomMarginRatio ?? 0.05,
    side: spec.sideMarginRatio ?? 0.1,
  };
  const photoW = outerW - border * 2;
  const photoH = outerH - border * 2;

  const trimmed = await sharp(imageBuffer)
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .trim({ threshold: 12, background: { r: 255, g: 255, b: 255 } })
    .toBuffer();
  const tmeta = await sharp(trimmed).metadata();
  const tw = tmeta.width || 1;
  const th = tmeta.height || 1;

  const topM = photoH * margins.top;
  const bottomM = photoH * margins.bottom;
  const sideM = photoW * margins.side;
  const availW = Math.max(1, photoW - sideM * 2);
  const availH = Math.max(1, photoH - topM - bottomM);
  const fitScale = Math.min(availW / tw, availH / th);
  const dw = Math.round(tw * fitScale);
  const dh = Math.round(th * fitScale);
  const innerDx = Math.round(sideM + (availW - dw) / 2);
  const innerDy = Math.round(topM + (availH - dh) / 2);

  const style = parseFrameStyle(frameStyleInput || {});
  const bg = hexToRgb(style.borderColor);
  const subject = await sharp(trimmed).resize(dw, dh, { fit: "fill" }).toBuffer();
  const whitePlate = await sharp({
    create: { width: photoW, height: photoH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  const plateWithSubject = await sharp(whitePlate)
    .composite([{ input: subject, left: innerDx, top: innerDy }])
    .png()
    .toBuffer();

  const composites = [
    { input: plateWithSubject, left: border, top: border },
    ...stickerCompositesForTemplate(style.stickerTemplate, border, photoW, photoH),
  ];
  const buffer = await sharp({
    create: { width: outerW, height: outerH, channels: 3, background: bg },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const rawCheck = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const whiteRatio = measureNearWhiteRatioRaw(
    rawCheck.data,
    rawCheck.info.width,
    rawCheck.info.height,
    rawCheck.info.channels
  );

  return { buffer, width: outerW, height: outerH, whiteRatio };
}

async function generateSupplierDenVariants(imageBuffer, frameStyleInput, categoryName) {
  const built = [];
  const frameStyle =
    isSupplierDenOneStickerTagName(categoryName)
      ? { ...parseFrameStyle(frameStyleInput || {}), stickerTemplate: "supplierden_one" }
      : frameStyleInput;
  for (const layoutSpec of SUPPLIERDEN_TALL_LAYOUTS) {
    const profile = {
      id: `supplierden_${layoutSpec.layout}`,
      path: "supplierden_match_50",
      modeName: `Tall · ${layoutSpec.panelTag}`,
    };
    const prepared = await prepareSupplierDenExactBuffer(imageBuffer, layoutSpec, frameStyle);
    for (const tier of layoutSpec.tiers) {
      const jpeg = await compressBusyToSlab(prepared.buffer, tier.slabKb);
      built.push({
        buffer: jpeg,
        fileSizeBytes: jpeg.length,
        fileSizeKb: kbFromBytes(jpeg.length),
        tagName: `[${profile.modeName}] ${tier.label} · ${prepared.width}×${prepared.height}`,
        recommended: !!tier.recommended,
        lowest: !!tier.lowest,
        width: prepared.width,
        height: prepared.height,
        processingPath: profile.path,
        profileId: profile.id,
        modeName: profile.modeName,
        flatlayPriority: layoutSpec.priority,
      });
    }
  }
  built.sort(
    (a, b) =>
      estimateMeeshoInr(a) - estimateMeeshoInr(b) ||
      (a.flatlayPriority ?? 99) - (b.flatlayPriority ?? 99) ||
      a.fileSizeBytes - b.fileSizeBytes
  );
  const exact703 = built.filter((b) => b.width === 703 && b.height === 1024);
  const pool =
    exact703.length > 0
      ? exact703
      : built.filter((b) => Math.max(b.width, b.height) <= 1024);
  return pool.slice(0, 56);
}

function profileStudio() {
  return { id: "studio", studio: true, tiers: TIERS_WHITE_BG, path: "studio", modeName: "Studio Compress" };
}

function profileStudioUltra() {
  return {
    id: "studio_ultra",
    studio: true,
    tiers: TIERS_STUDIO_ULTRA,
    path: "studio_ultra",
    modeName: "Studio Ultra",
    absMinQ: 14,
  };
}

function profileStudioBalanced() {
  return {
    id: "studio_balanced",
    studio: true,
    tiers: TIERS_STUDIO_BALANCED,
    path: "studio_balanced",
    modeName: "Studio ₹20–40",
  };
}

function profileFramed() {
  return {
    id: "framed",
    studio: false,
    tiers: TIERS_BUSY_BG,
    path: "framed_classic",
    modeName: "Framed Compress",
    framedMaxSide: MEESHO_FRAMED_MAX_SIDE,
  };
}

function profileFramedLow() {
  return {
    id: "framed_low",
    studio: false,
    tiers: TIERS_FRAMED_LOW,
    path: "framed_low",
    modeName: "Framed Best Rate",
    framedMaxSide: MEESHO_FRAMED_MAX_SIDE,
  };
}

function profileFramedPro() {
  return {
    id: "framed_pro",
    studio: false,
    tiers: TIERS_FRAMED_PRO,
    path: "framed_pro",
    modeName: "Framed Pro",
    framedMaxSide: MEESHO_FRAMED_MAX_SIDE,
  };
}

function profileSupplierDenMatch() {
  return {
    id: "supplierden_match",
    studio: false,
    supplierDenAll: true,
    tiers: TIERS_SUPPLIERDEN_50,
    path: "supplierden_match_50",
    modeName: "Tall ₹50",
    framedMaxSide: 1024,
  };
}

function autoTierPick(tier) {
  return !!(tier.lowest || tier.recommended);
}

function mozjpeg(buffer, quality, whiteRatio = 0, minQFloor = ABS_MIN_Q) {
  const q = Math.max(minQFloor, quality);
  return sharp(buffer).jpeg({
    quality: q,
    mozjpeg: true,
    chromaSubsampling: "4:2:0",
    progressive: true,
    optimizeScans: true,
    trellisQuantisation: true,
    overshootDeringing: true,
    quantisationTable: whiteRatio >= WHITE_BG_THRESHOLD ? 3 : 2,
  });
}

function standardJpeg(buffer, quality, minQ = BUSY_MIN_Q) {
  const q = Math.max(minQ, Math.min(98, quality));
  return sharp(buffer).jpeg({
    quality: q,
    mozjpeg: false,
    progressive: false,
    chromaSubsampling: "4:2:0",
  });
}

async function encodeAtQuality(buffer, quality, floor, whiteRatio = 0, studio = false, minQFloor) {
  const minQ = floor ?? adaptiveMinQ(whiteRatio);
  const q = Math.max(minQ, quality);
  if (studio) {
    return mozjpeg(buffer, q, whiteRatio, minQFloor ?? ABS_MIN_Q).toBuffer();
  }
  return standardJpeg(buffer, q).toBuffer();
}

function floodFillWhiteRaw(data, width, height, channels) {
  const total = width * height;
  const seen = new Uint8Array(total);
  const queue = [];

  function nearWhite(idx) {
    const o = idx * channels;
    return (
      255 - data[o] <= WHITE_TOL &&
      255 - data[o + 1] <= WHITE_TOL &&
      255 - data[o + 2] <= WHITE_TOL
    );
  }

  function push(idx) {
    if (seen[idx] || !nearWhite(idx)) return;
    seen[idx] = 1;
    queue.push(idx);
  }

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (queue.length) {
    const idx = queue.pop();
    const o = idx * channels;
    data[o] = 255;
    data[o + 1] = 255;
    data[o + 2] = 255;
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) push(idx - 1);
    if (x < width - 1) push(idx + 1);
    if (y > 0) push(idx - width);
    if (y < height - 1) push(idx + width);
  }

  let white = 0;
  for (let idx = 0; idx < total; idx++) {
    const o = idx * channels;
    if (!seen[idx]) {
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      if (r >= 248 && g >= 248 && b >= 248 && Math.max(r, g, b) - Math.min(r, g, b) < 10) {
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        seen[idx] = 1;
      }
    }
    if (data[o] === 255 && data[o + 1] === 255 && data[o + 2] === 255) white++;
  }

  return white / total;
}

function measureNearWhiteRatioRaw(data, width, height, channels) {
  let near = 0;
  const total = width * height;
  for (let idx = 0; idx < total; idx++) {
    const o = idx * channels;
    if (
      255 - data[o] <= WHITE_TOL &&
      255 - data[o + 1] <= WHITE_TOL &&
      255 - data[o + 2] <= WHITE_TOL
    ) {
      near++;
    }
  }
  return near / total;
}

function edgeNearWhiteRatioRaw(data, width, height, channels) {
  let near = 0;
  let total = 0;
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const o = (y * width + x) * channels;
      total++;
      if (
        255 - data[o] <= WHITE_TOL &&
        255 - data[o + 1] <= WHITE_TOL &&
        255 - data[o + 2] <= WHITE_TOL
      ) {
        near++;
      }
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      const o = (y * width + x) * channels;
      total++;
      if (
        255 - data[o] <= WHITE_TOL &&
        255 - data[o + 1] <= WHITE_TOL &&
        255 - data[o + 2] <= WHITE_TOL
      ) {
        near++;
      }
    }
  }
  return near / total;
}

function sideNearWhiteRatioRaw(data, width, height, channels, y0, y1, x0, x1) {
  let near = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * width + x) * channels;
      total++;
      if (
        255 - data[o] <= WHITE_TOL &&
        255 - data[o + 1] <= WHITE_TOL &&
        255 - data[o + 2] <= WHITE_TOL
      ) {
        near++;
      }
    }
  }
  return total ? near / total : 0;
}

async function isStudioWhiteBackground(buffer) {
  const { data, info } = await sharp(buffer)
    .resize(320, 320, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const top = sideNearWhiteRatioRaw(data, width, height, channels, 0, 1, 0, width);
  const bottom = sideNearWhiteRatioRaw(data, width, height, channels, height - 1, height, 0, width);
  const left = sideNearWhiteRatioRaw(data, width, height, channels, 0, height, 0, 1);
  const right = sideNearWhiteRatioRaw(data, width, height, channels, 0, height, width - 1, width);
  const allEdges = (top + bottom + left + right) / 4;
  const topLeftRight = (top + left + right) / 3;
  const fullRatio = measureNearWhiteRatioRaw(data, width, height, channels);
  if (allEdges >= 0.72 && fullRatio >= 0.5) return true;
  if (topLeftRight >= 0.8 && fullRatio >= 0.55) return true;
  if (fullRatio >= 0.7) return true;
  return false;
}

function resolveStudioMode(buffer, categoryName) {
  const tag = String(categoryName || "").toLowerCase();
  if (tag.includes("indoor") || tag.includes("busy") || INDOOR_CATEGORY_RE.test(tag)) return false;
  if (tag.includes("studio") || tag.includes("white studio") || STUDIO_CATEGORY_RE.test(tag)) return true;
  return isStudioWhiteBackground(buffer);
}

function resolveProcessingProfile(buffer, categoryName) {
  const tag = String(categoryName || "").toLowerCase();

  if (tag.includes("auto lowest") || tag.includes("auto detect") || tag.includes("auto shipping")) {
    return { id: "auto_all", auto: true, modeName: "Auto Lowest Shipping" };
  }
  if (tag.includes("studio ultra")) {
    return profileStudioUltra();
  }
  if (tag.includes("studio balanced") || tag.includes("studio ₹20") || tag.includes("studio 20-40")) {
    return profileStudioBalanced();
  }
  if (isSupplierDenTagName(categoryName)) {
    return profileSupplierDenMatch();
  }
  if (isRaincoatLowestTagName(categoryName)) {
    return { id: "raincoat_all", raincoat: true, modeName: "Raincoat Lowest ₹" };
  }
  if (
    tag.includes("framed pro") ||
    tag.includes("framed large") ||
    tag.includes("pro match") ||
    tag.includes("framed supplierden heavy") ||
    tag.includes("supplierden heavy")
  ) {
    return profileFramedPro();
  }
  if (tag.includes("framed best") || tag.includes("framed low") || tag.includes("framed minimum")) {
    return profileFramedLow();
  }
  if (tag.includes("framed compact") || tag.includes("compact frame")) {
    return {
      id: "framed_compact",
      studio: false,
      tiers: TIERS_FRAMED_LOW,
      path: "framed_compact",
      modeName: "Framed Compact",
      framedMaxSide: 1024,
    };
  }
  if (tag.includes("indoor") || tag.includes("busy") || INDOOR_CATEGORY_RE.test(tag)) {
    return profileFramed();
  }
  if (tag.includes("studio") || tag.includes("white studio") || STUDIO_CATEGORY_RE.test(tag)) {
    return profileStudio();
  }

  return isStudioWhiteBackground(buffer) ? profileStudio() : profileFramed();
}

function adaptiveMinQ(whiteRatio) {
  if (whiteRatio >= 0.78) return 24;
  if (whiteRatio >= 0.68) return 26;
  if (whiteRatio >= 0.55) return 30;
  if (whiteRatio >= 0.40) return 28;
  return 26;
}

function adaptiveAbsMinQ(whiteRatio) {
  if (whiteRatio >= 0.72) return 20;
  if (whiteRatio >= 0.58) return 22;
  return ABS_MIN_Q;
}

async function flattenBackgroundWhite(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const whiteRatio = floodFillWhiteRaw(data, info.width, info.height, info.channels);
  const out = await sharp(data, { raw: info }).removeAlpha().jpeg({ quality: 95, mozjpeg: true }).toBuffer();
  return { buffer: out, whiteRatio };
}

async function compressBusyToSlabOnce(buffer, slabKb) {
  const targetBytes = slabKb * 1024;
  const busyMin = BUSY_MIN_Q;
  let best = null;
  let lo = busyMin;
  let hi = 98;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const out = await standardJpeg(buffer, mid, busyMin).toBuffer();
    if (out.length <= targetBytes) {
      best = out;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best) return best;
  return standardJpeg(buffer, busyMin, busyMin).toBuffer();
}

async function compressBusyToSlab(buffer, slabKb) {
  return compressBusyToSlabOnce(buffer, slabKb);
}

async function compressBusyToSlabCapped(buffer, slabKb, aggressive = false) {
  const capBytes = slabKb * 1024;
  let best = await compressBusyToSlabOnce(buffer, slabKb);
  if (best.length <= capBytes) return best;
  let factor = 0.96;
  const minFactor = aggressive ? 0.5 : 0.78;
  while (factor >= minFactor) {
    const meta = await sharp(buffer).metadata();
    const w = Math.max(1, Math.round((meta.width || 1) * factor));
    const h = Math.max(1, Math.round((meta.height || 1) * factor));
    const scaled = await sharp(buffer).resize(w, h, { fit: "fill" }).toBuffer();
    const candidate = await compressBusyToSlabOnce(scaled, slabKb);
    if (candidate.length <= capBytes) return candidate;
    if (candidate.length < best.length) best = candidate;
    factor -= 0.04;
  }
  return best;
}

async function prepareRaincoatNativeBuffer(imageBuffer, capMaxSide) {
  let buffer = await sharp(imageBuffer).rotate().toBuffer();
  let meta = await sharp(buffer).metadata();
  let w = meta.width || 1;
  let h = meta.height || 1;
  const max0 = Math.max(w, h);
  const cap = capMaxSide ? Number(capMaxSide) : 0;
  if (cap > 0 && max0 > cap) {
    buffer = await sharp(buffer).resize(cap, cap, { fit: "inside", withoutEnlargement: true }).toBuffer();
    meta = await sharp(buffer).metadata();
    w = meta.width || w;
    h = meta.height || h;
  } else if (max0 > 2000) {
    buffer = await sharp(buffer).resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).toBuffer();
    meta = await sharp(buffer).metadata();
    w = meta.width || w;
    h = meta.height || h;
  }
  return { buffer, width: w, height: h };
}

function raincoatExactBorderPx(layoutSpec) {
  const outer = Math.min(layoutSpec.outerW ?? 1024, layoutSpec.outerH ?? 1024);
  const fallback = Math.max(20, Math.round(outer * 0.027));
  return Math.max(20, Math.round(layoutSpec.borderPx ?? fallback));
}

async function prepareRaincoatExactSquareBuffer(imageBuffer, layoutSpec, frameStyleInput) {
  const style = resolveRaincoatFrameStyle(frameStyleInput);
  const outerW = layoutSpec.outerW ?? 1024;
  const outerH = layoutSpec.outerH ?? 1024;
  const border = raincoatExactBorderPx(layoutSpec);
  const innerW = outerW - border * 2;
  const innerH = outerH - border * 2;

  const native = await prepareRaincoatNativeBuffer(imageBuffer, layoutSpec.capMaxSide);
  const subject = await sharp(native.buffer)
    .resize(innerW, innerH, { fit: "cover", position: "centre" })
    .toBuffer();
  const dx = border;
  const dy = border;
  const bg = hexToRgb(style.borderColor);
  const composites = [
    { input: subject, left: dx, top: dy },
    ...stickerCompositesForTemplate(style.stickerTemplate, border, innerW, innerH),
  ];
  const buffer = await sharp({
    create: { width: outerW, height: outerH, channels: 3, background: bg },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return { buffer, width: outerW, height: outerH, whiteRatio: 0 };
}

async function prepareRaincoatFramedBuffer(imageBuffer, layoutSpec, frameStyleInput) {
  if (layoutSpec.type === "raincoat_exact_square") {
    return prepareRaincoatExactSquareBuffer(imageBuffer, layoutSpec, frameStyleInput);
  }
  const style = resolveRaincoatFrameStyle(frameStyleInput);
  const native = await prepareRaincoatNativeBuffer(imageBuffer, layoutSpec.capMaxSide);
  const fitted = fitFramedPhotoDims(native.width, native.height, layoutSpec.framedMaxSide ?? 1024);
  let photo = native.buffer;
  if (fitted.w !== native.width || fitted.h !== native.height) {
    photo = await sharp(native.buffer).resize(fitted.w, fitted.h, { fit: "fill" }).toBuffer();
  }
  return prepareFramedBuffer(photo, fitted.w, fitted.h, layoutSpec.framedMaxSide ?? 1024, style);
}

async function generateRaincoatVariants(imageBuffer, frameStyleInput) {
  const built = [];
  for (const layoutSpec of RAINCOAT_LAYOUTS) {
    const prepared = await prepareRaincoatFramedBuffer(imageBuffer, layoutSpec, frameStyleInput);
    const profile = {
      id: `raincoat_${layoutSpec.layout}`,
      path: "raincoat_framed",
      modeName: `Raincoat · ${layoutSpec.panelTag}`,
    };
    for (const tier of RAINCOAT_KB_TIERS) {
      const jpeg = await compressBusyToSlabCapped(prepared.buffer, tier.slabKb, true);
      built.push({
        buffer: jpeg,
        fileSizeBytes: jpeg.length,
        fileSizeKb: kbFromBytes(jpeg.length),
        tagName: `[${profile.modeName}] ${tier.label} · ${prepared.width}×${prepared.height}`,
        recommended: !!tier.recommended,
        lowest: !!tier.lowest,
        width: prepared.width,
        height: prepared.height,
        processingPath: profile.path,
        profileId: profile.id,
        modeName: profile.modeName,
        flatlayPriority: layoutSpec.priority,
      });
    }
  }
  const slabCapBytes = 68 * 1024;
  const inSlab = built.filter((b) => (b.fileSizeBytes || 0) > 0 && b.fileSizeBytes <= slabCapBytes);
  const portraitCap = inSlab.filter(
    (b) => (b.height || 0) > (b.width || 0) && Math.max(b.width, b.height) <= 1024
  );
  const promoP1024 = portraitCap.filter((b) => String(b.profileId || "").includes("rc_p1024"));
  const pool = promoP1024.length ? promoP1024 : portraitCap.length ? portraitCap : inSlab;
  if (!pool.length) return [];
  pool.sort(
    (a, b) =>
      estimateMeeshoInr(a) - estimateMeeshoInr(b) ||
      a.fileSizeBytes - b.fileSizeBytes
  );
  const best = pool[0];
  best.autoBest = true;
  best.recommended = true;
  best.lowest = true;
  return [best];
}

async function compressToTarget(buffer, targetBytes, minQ, whiteRatio, studio, absMinOverride) {
  if (!studio) {
    throw new Error("compressToTarget is studio-only; use compressBusyToSlab for busy photos");
  }

  const absMin = absMinOverride ?? adaptiveAbsMinQ(whiteRatio);
  let lo = minQ;
  let hi = 92;
  let best = await encodeAtQuality(buffer, lo, lo, whiteRatio, studio, absMin);

  if (best.length <= targetBytes) {
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      const out = await encodeAtQuality(buffer, mid, lo, whiteRatio, studio, absMin);
      if (out.length <= targetBytes) {
        best = out;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const top = await encodeAtQuality(buffer, lo, lo, whiteRatio, studio, absMin);
    if (top.length <= targetBytes) return top;
  }

  for (let q = lo - 1; q >= absMin && best.length > targetBytes; q--) {
    const out = await encodeAtQuality(buffer, q, absMin, whiteRatio, studio, absMin);
    if (out.length <= targetBytes) return out;
    if (out.length < best.length) best = out;
  }

  return best;
}

export async function prepareInput(imageBuffer, profile, frameStyleInput) {
  const mergedFrameStyle = {
    ...defaultFrameStyle(),
    ...parseFrameStyle(frameStyleInput || {}),
    ...(profile.frameStyleOverride || {}),
  };
  const inputBytes = imageBuffer.length;
  let buffer = await sharp(imageBuffer).rotate().toBuffer();

  let meta = await sharp(buffer).metadata();
  let w = meta.width || 0;
  let h = meta.height || 0;

  if (Math.max(w, h) > 2000) {
    buffer = await sharp(buffer)
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
    meta = await sharp(buffer).metadata();
    w = meta.width || w;
    h = meta.height || h;
  }

  let whiteRatio = 0;
  const framedMaxSide = profile.framedMaxSide ?? MEESHO_FRAMED_MAX_SIDE;

  if (profile.studio) {
    const rawCheck = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    whiteRatio = measureNearWhiteRatioRaw(
      rawCheck.data,
      rawCheck.info.width,
      rawCheck.info.height,
      rawCheck.info.channels
    );
  } else {
    buffer = await sharp(buffer).flatten({ background: { r: 255, g: 255, b: 255 } }).toBuffer();
    const fitted = fitFramedPhotoDims(w, h, framedMaxSide);
    if (fitted.w !== w || fitted.h !== h) {
      buffer = await sharp(buffer)
        .resize(fitted.w, fitted.h, { fit: "fill" })
        .toBuffer();
      w = fitted.w;
      h = fitted.h;
    }
    const framed = await prepareFramedBuffer(buffer, w, h, framedMaxSide, mergedFrameStyle);
    buffer = framed.buffer;
    w = framed.width;
    h = framed.height;
    const rawCheck = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    whiteRatio = measureNearWhiteRatioRaw(
      rawCheck.data,
      rawCheck.info.width,
      rawCheck.info.height,
      rawCheck.info.channels
    );
  }

  return {
    buffer,
    width: w,
    height: h,
    inputBytes,
    whiteRatio,
    minQ: adaptiveMinQ(whiteRatio),
    studio: profile.studio,
    profile,
  };
}

async function buildVariant(prepared, tier, showMode = false) {
  const profile = prepared.profile;
  const jpeg = profile.studio
    ? await compressToTarget(
        prepared.buffer,
        tier.targetKb * 1024,
        prepared.minQ,
        prepared.whiteRatio,
        true,
        profile.absMinQ
      )
    : await compressBusyToSlab(prepared.buffer, tier.slabKb);

  const tagName = showMode
    ? `[${profile.modeName || profile.id}] ${tier.label} · ${prepared.width}×${prepared.height}`
    : `${tier.label} · ${prepared.width}×${prepared.height}`;

  return {
    buffer: jpeg,
    fileSizeBytes: jpeg.length,
    fileSizeKb: kbFromBytes(jpeg.length),
    tagName,
    recommended: !!tier.recommended,
    lowest: !!tier.lowest,
    width: prepared.width,
    height: prepared.height,
    processingPath: profile.path,
    profileId: profile.id,
    modeName: profile.modeName || profile.id,
  };
}

async function autoProfilesForBuffer(buffer) {
  return (await isStudioWhiteBackground(buffer))
    ? [profileStudioUltra(), profileStudioBalanced(), profileStudio()]
    : [profileFramedLow(), profileFramed(), profileFramedPro()];
}

async function generateAutoVariants(imageBuffer, categoryName, frameStyleInput) {
  const rotated = await sharp(imageBuffer).rotate().toBuffer();
  const profiles = await autoProfilesForBuffer(rotated);
  const built = [];
  for (const profile of profiles) {
    const prepared = await prepareInput(imageBuffer, profile, frameStyleInput);
    for (const tier of profile.tiers.filter(autoTierPick)) {
      built.push(await buildVariant(prepared, tier, true));
    }
  }
  built.sort((a, b) => estimateMeeshoInr(a) - estimateMeeshoInr(b));
  if (built.length) {
    built[0].autoBest = true;
    built[0].recommended = true;
  }
  return built;
}

export async function generateAllVariants(imageBuffer, categoryName, frameStyleInput) {
  const rotated = await sharp(imageBuffer).rotate().toBuffer();
  const built = isSupplierDenTagName(categoryName)
    ? await generateSupplierDenVariants(imageBuffer, frameStyleInput, categoryName)
    : isRaincoatLowestTagName(categoryName)
      ? await generateRaincoatVariants(imageBuffer, frameStyleInput)
      : await (async () => {
        const profile = resolveProcessingProfile(rotated, categoryName);
        if (profile.auto) {
          return generateAutoVariants(imageBuffer, categoryName, frameStyleInput);
        }
        const prepared = await prepareInput(imageBuffer, profile, frameStyleInput);
        const items = [];
        for (const tier of profile.tiers) {
          items.push(await buildVariant(prepared, tier));
        }
        return items;
      })();

  const minEstimate = Math.min(...built.map((b) => estimateMeeshoInr(b)));

  return built.map((item) => ({
    imageUrl: `data:image/jpeg;base64,${item.buffer.toString("base64")}`,
    tagName: `${item.tagName} · ${item.fileSizeKb} KB`,
    fileSizeBytes: item.fileSizeBytes,
    fileSizeKb: item.fileSizeKb,
    shippingCharge: String(estimateMeeshoInr(item)),
    estimatedShippingInr: estimateMeeshoInr(item),
    shippingEstimate: true,
    processingPath: item.processingPath,
    profileId: item.profileId,
    modeName: item.modeName,
    width: item.width,
    height: item.height,
    lowest: estimateMeeshoInr(item) === minEstimate,
    recommended: item.recommended,
    autoBest: !!item.autoBest,
    categoryName,
  }));
}
