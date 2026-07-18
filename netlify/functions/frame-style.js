/** Shared framed border + sticker template config (browser + server). */

export const DEFAULT_BORDER_COLOR = "#FF7900";

export const BORDER_PRESETS = [
  { id: "classic_orange", name: "Classic Orange", color: "#FF7900" },
  { id: "meesho_red", name: "Sale Red", color: "#E53935" },
  { id: "royal_blue", name: "Royal Blue", color: "#1565C0" },
  { id: "emerald", name: "Emerald Green", color: "#059669" },
  { id: "purple", name: "Purple", color: "#7C3AED" },
  { id: "black", name: "Black", color: "#111827" },
  { id: "custom", name: "Custom RGB / hex", color: null },
];

export const STICKER_TEMPLATES = [
  { id: "classic_promo", name: "Classic Promo", desc: "SPECIAL OFFER + HOT SALE burst" },
  {
    id: "supplierden_match",
    name: "Tall dress promo",
    desc: "FREE DELIVERY + BEST CHOICE OFFER",
  },
  {
    id: "supplierden_one",
    name: "Tall dress · free delivery",
    desc: "FREE DELIVERY sticker only",
  },
  { id: "none", name: "Frame only", desc: "Border color only — no stickers" },
  { id: "mega_sale", name: "Mega Sale", desc: "Large MEGA SALE badge top-right" },
  { id: "best_price", name: "Best Price", desc: "BEST PRICE ribbon corner" },
  { id: "limited_time", name: "Limited Time", desc: "LIMITED TIME urgency badge" },
  { id: "flash_deal", name: "Flash Deal", desc: "FLASH DEAL star burst" },
  { id: "super_offer", name: "Super Offer", desc: "SUPER OFFER + flat 50% tag" },
];

export const BORDER_WIDTH_PRESETS = [
  { id: "thin", name: "Thin border", scale: 0.55 },
  { id: "standard", name: "Standard", scale: 1 },
  { id: "thick", name: "Thick border", scale: 1.35 },
];

const TEMPLATE_IDS = new Set(STICKER_TEMPLATES.map((t) => t.id));
const TEMPLATE_ALIASES = { supplierden: "supplierden_match", supplierden_one_sticker: "supplierden_one" };
const PRESET_ALIASES = { supplierden: "purple" };
const BORDER_WIDTH_PRESET_IDS = new Set(BORDER_WIDTH_PRESETS.map((p) => p.id));

export function normalizeBorderColor(input) {
  const raw = String(input || "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
  const hex3 = raw.match(/^#([0-9A-Fa-f]{3})$/);
  if (hex3) {
    const h = hex3[1];
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase();
  }
  const rgb = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgb) {
    return (
      "#" +
      [rgb[1], rgb[2], rgb[3]]
        .map((n) => Math.min(255, Math.max(0, parseInt(n, 10))).toString(16).padStart(2, "0"))
        .join("")
    ).toUpperCase();
  }
  const parts = raw.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (parts) {
    return (
      "#" +
      [parts[1], parts[2], parts[3]]
        .map((n) => Math.min(255, Math.max(0, parseInt(n, 10))).toString(16).padStart(2, "0"))
        .join("")
    ).toUpperCase();
  }
  return DEFAULT_BORDER_COLOR;
}

export function hexToRgb(hex) {
  const h = normalizeBorderColor(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function normalizeStickerTemplate(input) {
  let id = String(input || "classic_promo").trim().toLowerCase();
  if (TEMPLATE_ALIASES[id]) id = TEMPLATE_ALIASES[id];
  return TEMPLATE_IDS.has(id) ? id : "classic_promo";
}

export function normalizeBorderPreset(input) {
  let id = String(input || "classic_orange").trim().toLowerCase();
  if (PRESET_ALIASES[id]) id = PRESET_ALIASES[id];
  return id;
}

export function normalizeBorderWidthPreset(input) {
  const id = String(input || "standard").trim().toLowerCase();
  return BORDER_WIDTH_PRESET_IDS.has(id) ? id : "standard";
}

export function normalizeBorderWidthAdjust(input) {
  const n = Number(input);
  if (!Number.isFinite(n)) return 100;
  return Math.min(140, Math.max(60, Math.round(n)));
}

export function resolveBorderWidthScale(frameStyle) {
  const style = frameStyle || {};
  const preset =
    BORDER_WIDTH_PRESETS.find((p) => p.id === normalizeBorderWidthPreset(style.borderWidthPreset)) ||
    BORDER_WIDTH_PRESETS.find((p) => p.id === "standard");
  const adjust = normalizeBorderWidthAdjust(style.borderWidthAdjust ?? 100);
  return Math.max(0.35, Math.min(1.75, preset.scale * (adjust / 100)));
}

export function parseFrameStyle(fields = {}) {
  return {
    borderColor: normalizeBorderColor(fields.frameBorderColor || fields.borderColor),
    stickerTemplate: normalizeStickerTemplate(fields.frameStickerTemplate || fields.stickerTemplate),
    borderWidthPreset: normalizeBorderWidthPreset(fields.frameBorderWidthPreset || fields.borderWidthPreset),
    borderWidthAdjust: normalizeBorderWidthAdjust(fields.frameBorderWidthAdjust ?? fields.borderWidthAdjust),
  };
}

export function defaultFrameStyle() {
  return {
    borderColor: DEFAULT_BORDER_COLOR,
    stickerTemplate: "classic_promo",
    borderWidthPreset: "standard",
    borderWidthAdjust: 100,
  };
}
