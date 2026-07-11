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
  { id: "none", name: "Frame only", desc: "Border color only — no stickers" },
  { id: "mega_sale", name: "Mega Sale", desc: "Large MEGA SALE badge top-right" },
  { id: "best_price", name: "Best Price", desc: "BEST PRICE ribbon corner" },
  { id: "limited_time", name: "Limited Time", desc: "LIMITED TIME urgency badge" },
  { id: "flash_deal", name: "Flash Deal", desc: "FLASH DEAL star burst" },
  { id: "super_offer", name: "Super Offer", desc: "SUPER OFFER + flat 50% tag" },
];

const TEMPLATE_IDS = new Set(STICKER_TEMPLATES.map((t) => t.id));
const TEMPLATE_ALIASES = { supplierden: "classic_promo" };
const PRESET_ALIASES = { supplierden: "classic_orange" };

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

export function parseFrameStyle(fields = {}) {
  return {
    borderColor: normalizeBorderColor(fields.frameBorderColor || fields.borderColor),
    stickerTemplate: normalizeStickerTemplate(fields.frameStickerTemplate || fields.stickerTemplate),
  };
}

export function defaultFrameStyle() {
  return { borderColor: DEFAULT_BORDER_COLOR, stickerTemplate: "classic_promo" };
}
