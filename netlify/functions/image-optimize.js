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

// ── GOWN ───────────────────────────────────────────────────────────────────
const GOWN_DEFAULT_TEAL = "#06B6D4";
const GOWN_KB_TIERS = [
  { slabKb: 48, label: "48KB", lowest: true },
  { slabKb: 50, label: "50KB" },
  { slabKb: 52, label: "52KB" },
  { slabKb: 54, label: "54KB" },
  { slabKb: 56, label: "56KB · confirmed ₹55", recommended: true },
  { slabKb: 60, label: "60KB" },
  { slabKb: 63, label: "63KB" },
];
const GOWN_LAYOUTS = [
  { layout: "gown_f800",    framedMaxSide: 800,                   priority: 0, panelTag: "framed 800 · gown promo",  tiers: GOWN_KB_TIERS },
  { layout: "gown_f800_ns", framedMaxSide: 800, noStickers: true, priority: 1, panelTag: "framed 800 · no stickers", tiers: GOWN_KB_TIERS },
  { layout: "gown_f700",    framedMaxSide: 700,                   priority: 2, panelTag: "framed 700 · gown promo",  tiers: GOWN_KB_TIERS },
  { layout: "gown_f700_ns", framedMaxSide: 700, noStickers: true, priority: 3, panelTag: "framed 700 · no stickers", tiers: GOWN_KB_TIERS },
  { layout: "gown_f600",    framedMaxSide: 600,                   priority: 4, panelTag: "framed 600 · gown promo",  tiers: GOWN_KB_TIERS },
  { layout: "gown_f600_ns", framedMaxSide: 600, noStickers: true, priority: 5, panelTag: "framed 600 · no stickers", tiers: GOWN_KB_TIERS },
  { layout: "gown_f500",    framedMaxSide: 500,                   priority: 6, panelTag: "framed 500 · gown promo",  tiers: GOWN_KB_TIERS },
  { layout: "gown_f500_ns", framedMaxSide: 500, noStickers: true, priority: 7, panelTag: "framed 500 · no stickers", tiers: GOWN_KB_TIERS },
];
// ── END GOWN ────────────────────────────────────────────────────────────────

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

function mostPopularSvg(scale) {
  const w = 100 * scale;
  const h = 52 * scale;
  const pad = 8 * scale;
  const bw = w + pad * 2;
  const bh = h + pad * 2;
  const font = 11.5 * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bw)}" height="${Math.ceil(bh)}" viewBox="0 0 ${Math.ceil(bw)} ${Math.ceil(bh)}">
    <g transform="translate(${pad},${pad})">
      <rect x="0" y="0" width="${w * 0.45}" height="${h}" rx="${6 * scale}" fill="#D32F2F"/>
      <text x="${w * 0.225}" y="${h * 0.42}" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="${12 * scale}" font-weight="900" text-anchor="middle">👍</text>
      <rect x="${w * 0.5}" y="0" width="${w * 0.5}" height="${h}" rx="${6 * scale}" fill="#FFFFFF" stroke="#111827" stroke-width="${1.5 * scale}"/>
      <text x="${w * 0.75}" y="${h * 0.38}" fill="#111827" font-family="Arial,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle">MOST</text>
      <text x="${w * 0.75}" y="${h * 0.74}" fill="#111827" font-family="Arial,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle">POPULAR</text>
    </g>
  </svg>`);
}

function flashSaleSvg(scale) {
  const w = 96 * scale;
  const h = 52 * scale;
  const pad = 8 * scale;
  const bw = w + pad * 2;
  const bh = h + pad * 2;
  const font = 12 * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bw)}" height="${Math.ceil(bh)}" viewBox="0 0 ${Math.ceil(bw)} ${Math.ceil(bh)}">
    <g transform="translate(${pad},${pad})">
      <rect x="0" y="0" width="${w * 0.42}" height="${h}" rx="${6 * scale}" fill="#E53935"/>
      <text x="${w * 0.21}" y="${h * 0.56}" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="${15 * scale}" font-weight="900" text-anchor="middle">⚡</text>
      <rect x="${w * 0.47}" y="0" width="${w * 0.53}" height="${h}" rx="${6 * scale}" fill="#FFFFFF" stroke="#111827" stroke-width="${1.5 * scale}"/>
      <text x="${w * 0.735}" y="${h * 0.38}" fill="#111827" font-family="Arial,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle">FLASH</text>
      <text x="${w * 0.735}" y="${h * 0.74}" fill="#E53935" font-family="Arial,sans-serif" font-size="${font}" font-weight="900" text-anchor="middle">SALE</text>
    </g>
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
  } else if (template === "gown_promo") {
    const bestW = 100 * scale * 0.9 + 8 * scale * 2;
    const bestH = 52 * scale * 0.9 + 8 * scale * 2;
    composites.push({
      input: bestPriceSvg(scale * 0.88),
      left: Math.round(border + width * 0.02),
      top: Math.round(border + height * 0.03),
    });
    composites.push({
      input: flashSaleSvg(scale * 0.88),
      left: Math.round(border + width * 0.68),
      top: Math.round(border + height * 0.03),
    });
    composites.push({
      input: mostPopularSvg(scale * 0.82),
      left: Math.round(border + width * 0.02),
      top: Math.round(border + height * 0.60),
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
  const w = item.width || 0;
  const h = item.height || 0;
  const path = item.processingPath || "";
  if (path === "supplierden_match_50") {
    if (maxSide > 0 && maxSide <= 1024 && fileKb >= 37 && fileKb <= 55) return Math.min(fileKb, 50);
    if (maxSide > 1024 && maxSide <= MEESHO_FRAMED_MAX_SIDE) return Math.min(fileKb, 79);
    return Math.min(fileKb, 50);
  }
  if (path === "gown_framed") {
    return fileKb;
  }
  if (MEESHO_FRAMED_DIM_CAP_PATHS.has(path) && maxSide > 0 && maxSide <= MEESHO_FRAMED_MAX_SIDE) {
    return Math.min(fileKb, 93);
  }
  return fileKb;
}

function isGownTagName(tagName) {
  const tag = String(tagName || "").toLowerCase();
  return (
    (tag.includes("gown") && tag.includes("lowest")) ||
    tag.includes("gown outdoor") ||
    tag.includes("gown framed")
  );
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
  if (
    tag.includes("supplierden match") ||
    tag.includes("supplierden ₹50") ||
    tag.includes("supplierden 50") ||
    tag.includes("supplierden lowest") ||
    (tag.includes("tall dress") && tag.includes("₹50"))
  ) {
    return profileSupplierDenMatch();
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

async function generateGownVariants(imageBuffer, frameStyleInput) {
  const userStyle = parseFrameStyle(frameStyleInput || {});
  const baseStyle = {
    ...defaultFrameStyle(),
    ...userStyle,
    borderColor: userStyle.borderColor || GOWN_DEFAULT_TEAL,
    stickerTemplate: userStyle.stickerTemplate || "gown_promo",
  };

  // Pre-rotate & cap source
  let srcBuf = await sharp(imageBuffer).rotate().toBuffer();
  let srcMeta = await sharp(srcBuf).metadata();
  if (Math.max(srcMeta.width || 0, srcMeta.height || 0) > 2000) {
    srcBuf = await sharp(srcBuf).resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).toBuffer();
    srcMeta = await sharp(srcBuf).metadata();
  }

  const built = [];
  for (const layoutSpec of GOWN_LAYOUTS) {
    const style = layoutSpec.noStickers
      ? { ...baseStyle, stickerTemplate: "none" }
      : baseStyle;
    const profile = {
      id: `gown_${layoutSpec.layout}`,
      path: "gown_framed",
      modeName: `Gown · ${layoutSpec.panelTag}`,
    };
    const maxSide = layoutSpec.framedMaxSide ?? 1024;
    let w = srcMeta.width || 1;
    let h = srcMeta.height || 1;
    let fitBuf = srcBuf;
    const fitted = fitFramedPhotoDims(w, h, maxSide);
    if (fitted.w !== w || fitted.h !== h) {
      fitBuf = await sharp(srcBuf).resize(fitted.w, fitted.h, { fit: "fill" }).toBuffer();
    }
    const framed = await prepareFramedBuffer(fitBuf, fitted.w, fitted.h, maxSide, style);

    for (const tier of GOWN_KB_TIERS) {
      let jpeg = await compressBusyToSlab(framed.buffer, tier.slabKb);
      // Aggressive downscale if needed to hit slab
      if (jpeg.length > tier.slabKb * 1024) {
        let factor = 0.92;
        while (factor >= 0.55) {
          const sm = await sharp(framed.buffer).resize(
            Math.max(1, Math.round(framed.width * factor)),
            Math.max(1, Math.round(framed.height * factor)),
            { fit: "fill" }
          ).toBuffer();
          const attempt = await compressBusyToSlab(sm, tier.slabKb);
          if (attempt.length <= tier.slabKb * 1024) { jpeg = attempt; break; }
          if (attempt.length < jpeg.length) jpeg = attempt;
          factor -= 0.05;
        }
      }
      built.push({
        buffer: jpeg,
        fileSizeBytes: jpeg.length,
        fileSizeKb: kbFromBytes(jpeg.length),
        tagName: `[${profile.modeName}] ${tier.label} · ${framed.width}×${framed.height}`,
        recommended: !!tier.recommended,
        lowest: !!tier.lowest,
        width: framed.width,
        height: framed.height,
        processingPath: profile.path,
        profileId: profile.id,
        modeName: profile.modeName,
        flatlayPriority: layoutSpec.priority,
      });
    }
  }

  // Sort by estimated shipping; dedupe by (fileSizeKb, dims)
  built.sort((a, b) => estimateMeeshoInr(a) - estimateMeeshoInr(b) || a.fileSizeBytes - b.fileSizeBytes);
  const seen = new Set();
  const deduped = built.filter((b) => {
    const key = `${b.fileSizeKb}-${b.width}x${b.height}-${b.profileId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Pin reference-matching variant (#1): 800px with promo stickers at ≤63 KB
  const isRef = (b) =>
    String(b.profileId || "").includes("f800") &&
    !String(b.profileId || "").includes("_ns") &&
    b.fileSizeBytes <= 64 * 1024;
  const refItem = deduped.filter(isRef)
    .sort((a, b) => Math.abs(a.fileSizeBytes - 63*1024) - Math.abs(b.fileSizeBytes - 63*1024))[0];
  const rest = deduped.filter((b) => b !== refItem);
  const ordered = refItem ? [refItem, ...rest] : rest;
  const minEstimate = Math.min(...ordered.map((b) => estimateMeeshoInr(b)));
  ordered.forEach((b, i) => {
    b.autoRank = i + 1;
    b.autoBest = i === 0;
    b.lowest = estimateMeeshoInr(b) === minEstimate;
    b.recommended = i < 3;
  });
  return ordered.slice(0, 32);
}

export async function generateAllVariants(imageBuffer, categoryName, frameStyleInput) {
  const rotated = await sharp(imageBuffer).rotate().toBuffer();
  const built = isSupplierDenTagName(categoryName)
    ? await generateSupplierDenVariants(imageBuffer, frameStyleInput, categoryName)
    : isGownTagName(categoryName)
      ? await generateGownVariants(imageBuffer, frameStyleInput)
      : (await (async () => {
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
        })());

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
