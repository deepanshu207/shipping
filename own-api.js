/**
 * Own API for Meesho Image Generator — runs entirely in the browser.
 */
(function () {
  /** Busy/indoor: orange frame format, then compress to Meesho slab sizes (empirical, not guaranteed ₹). */
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
  /** Smaller white-studio targets — push below typical ₹66 tier on Meesho. */
  const TIERS_STUDIO_ULTRA = [
    { targetKb: 16, label: "Ultra minimum · verify ₹ on Meesho", lowest: true },
    { targetKb: 18, label: "Recommended · lowest studio", recommended: true },
    { targetKb: 20, label: "Standard ultra" },
    { targetKb: 22, label: "High detail backup" },
  ];
  /** Full-resolution white studio — targets typical ₹20–₹40 Meesho tier without shrinking pixels. */
  const TIERS_STUDIO_BALANCED = [
    { targetKb: 20, label: "₹20 range · full size display", lowest: true },
    { targetKb: 24, label: "Recommended · ₹20–40 on Meesho", recommended: true },
    { targetKb: 28, label: "Standard · mid band" },
    { targetKb: 32, label: "Higher detail" },
    { targetKb: 36, label: "Upper ₹20–40 band" },
    { targetKb: 40, label: "Max quality · ₹40 ceiling", recommended: true },
  ];
  /** Studio compression on any photo (no orange frame) — indoor sellers trying ₹20–40; verify on Meesho. */
  const TIERS_STUDIO_ANY = [
    { targetKb: 22, label: "Entry ₹20 band · verify on Meesho", lowest: true },
    { targetKb: 28, label: "Recommended · mid ₹20–40", recommended: true },
    { targetKb: 34, label: "Balanced detail" },
    { targetKb: 40, label: "Max quality in ₹20–40 band" },
  ];
  /** Experimental mid slabs — try to beat ₹66–₹93 framed tier on Meesho. */
  const TIERS_FRAMED_MID = [
    { slabKb: 48, label: "Lowest slab · verify ₹ on Meesho", lowest: true },
    { slabKb: 52, label: "Low slab try" },
    { slabKb: 56, label: "Recommended · beat ₹70 band", recommended: true },
    { slabKb: 60, label: "Mid slab" },
    { slabKb: 63, label: "Near ₹64 ceiling" },
  ];
  /** Tight framed classic — still orange frame but lower KB targets. */
  const TIERS_FRAMED_CLASSIC_LOW = [
    { slabKb: 85, label: "Lowest classic frame", lowest: true },
    { slabKb: 88, label: "Recommended · under ₹93", recommended: true },
    { slabKb: 91, label: "₹91 slab try" },
    { slabKb: 93, label: "Standard framed match" },
  ];
  /** Mid slabs — matches ₹66–₹71 uploads some sellers see on Meesho. */
  const TIERS_FRAMED_LOW = [
    { slabKb: 64, label: "Lowest · try on Meesho first", lowest: true },
    { slabKb: 66, label: "Recommended · ₹66 slab", recommended: true },
    { slabKb: 68, label: "Balanced" },
    { slabKb: 71, label: "₹71 backup" },
  ];
  /** Back — 52 KB hits ₹146 on Meesho; 55 KB confirmed ~₹41. */
  const TIERS_LINGERIE_BACK = [
    { targetKb: 55, label: "Back · ~55 KB · ~₹41", recommended: true, lowest: true },
    { targetKb: 54, label: "Back · 54 KB" },
    { targetKb: 56, label: "Back · 56 KB" },
    { targetKb: 58, label: "Back · 58 KB" },
  ];
  /**
   * Front layouts — multiple KB tiers per canvas (like back panel 54–58 band).
   * No 52 KB (₹146). 900·44KB → ~₹66 · 1200·48KB → ~₹71.
   */
  const LINGERIE_FRONT_LAYOUTS = [
    {
      layout: "f_900_std",
      priority: 0,
      side: 900,
      coverage: 0.68,
      panelTag: "front 900",
      tiers: [
        { targetKb: 44, label: "44KB · ~₹66", recommended: true, lowest: true },
        { targetKb: 42, label: "42KB" },
        { targetKb: 46, label: "46KB" },
        { targetKb: 40, label: "40KB" },
      ],
    },
    {
      layout: "f_1200_wide",
      priority: 10,
      side: 1200,
      coverage: 0.56,
      panelTag: "front 1200",
      tiers: [
        { targetKb: 48, label: "48KB · ~₹71", recommended: true, lowest: true },
        { targetKb: 44, label: "44KB" },
        { targetKb: 46, label: "46KB" },
        { targetKb: 55, label: "55KB" },
      ],
    },
    {
      layout: "f_1000_mid",
      priority: 20,
      side: 1000,
      coverage: 0.62,
      panelTag: "front 1000",
      tiers: [
        { targetKb: 44, label: "44KB", recommended: true, lowest: true },
        { targetKb: 48, label: "48KB" },
        { targetKb: 42, label: "42KB" },
        { targetKb: 55, label: "55KB" },
      ],
    },
    {
      layout: "f_900_compact",
      priority: 30,
      side: 900,
      coverage: 0.56,
      panelTag: "front 900 compact",
      tiers: [
        { targetKb: 48, label: "48KB", recommended: true, lowest: true },
        { targetKb: 44, label: "44KB" },
        { targetKb: 46, label: "46KB" },
        { targetKb: 40, label: "40KB" },
      ],
    },
    {
      layout: "f_1200_std",
      priority: 40,
      side: 1200,
      coverage: 0.68,
      panelTag: "front 1200 tight",
      tiers: [
        { targetKb: 44, label: "44KB", recommended: true, lowest: true },
        { targetKb: 48, label: "48KB" },
        { targetKb: 46, label: "46KB" },
        { targetKb: 55, label: "55KB" },
      ],
    },
  ];
  /** Large framed files — same 1280px cap; Meesho may tier on dimensions not KB alone. */
  const TIERS_FRAMED_PRO = [
    { slabKb: 177, label: "Large file ~177 KB", lowest: true },
    { slabKb: 185, label: "Recommended · large file low ₹", recommended: true },
    { slabKb: 193, label: "Standard large framed" },
    { slabKb: 200, label: "High detail · pro framed match" },
  ];

  const WHITE_TOL = 42;
  const WHITE_BG_THRESHOLD = 0.62;
  const ABS_MIN_Q = 18;
  const BUSY_MIN_Q = 15;
  const MAX_SIDE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 1200 : 2000;
  const MOZJPEG_TIMEOUT_MS = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 90000 : 45000;
  const AUTO_MIN_VARIANTS = 10;
  const AUTO_MAX_VARIANTS = 30;
  const LINGERIE_MAX_VARIANTS = 48;
  const LINGERIE_PROCESS_TIMEOUT_MS = 360000;
  const AUTO_PROCESS_TIMEOUT_MS = 540000;
  const PROCESS_TIMEOUT_MS = 180000;
  const STALE_BUFFER_MS = 30000;
  const PROGRESS_PERSIST_MS = 400;
  const PROCESSING = new Set();
  const MOZJPEG_URL = () => new URL("/vendor/mozjpeg.mjs", location.origin).href;
  const FRAME_DEFAULT_ORANGE = "#FF7900";
  const FRAME_DEFAULT_PURPLE = "#7C3AED";
  const FRAME_DEFAULT_STICKER = "limited_time";
  const FRAME_LS_BORDER = "meesho_frame_border_color";
  const FRAME_LS_TEMPLATE = "meesho_frame_sticker_template";
  const FRAME_LS_PRESET = "meesho_frame_border_preset";
  const BORDER_PRESETS = [
    { id: "classic_orange", name: "Classic Orange", color: "#FF7900" },
    { id: "meesho_red", name: "Sale Red", color: "#E53935" },
    { id: "royal_blue", name: "Royal Blue", color: "#1565C0" },
    { id: "emerald", name: "Emerald Green", color: "#059669" },
    { id: "purple", name: "Purple", color: "#7C3AED" },
    { id: "black", name: "Black", color: "#111827" },
  ];
  const STICKER_TEMPLATE_META = [
    { id: "classic_promo", name: "Classic Promo", desc: "SPECIAL OFFER + HOT SALE" },
    { id: "none", name: "Frame only", desc: "No promotion stickers" },
    { id: "mega_sale", name: "Mega Sale", desc: "Large MEGA SALE badge" },
    { id: "best_price", name: "Best Price", desc: "BEST PRICE corner ribbon" },
    { id: "limited_time", name: "Limited Time", desc: "LIMITED TIME urgency tag" },
    { id: "flash_deal", name: "Flash Deal", desc: "FLASH DEAL star burst" },
    { id: "super_offer", name: "Super Offer", desc: "SUPER OFFER + 50% OFF" },
  ];
  const STICKER_TEMPLATE_IDS = new Set(STICKER_TEMPLATE_META.map((t) => t.id));
  const STICKER_TEMPLATE_ALIASES = { supplierden: "classic_promo" };
  const BORDER_PRESET_ALIASES = { supplierden: "classic_orange" };
  const FRAME_BORDER_RATIO = 0.048;
  const FRAME_MIN_BORDER = 34;
  const MEESHO_FRAMED_DIM_CAP_PATHS = new Set([
    "framed_classic",
    "framed_pro",
    "framed_low",
    "framed_mid",
    "framed_compact",
    "framed_mini",
    "supplierden",
    "supplierden_heavy",
  ]);
  /** Meesho may tier on max framed side — pro sellers often cap near 1280px. */
  const MEESHO_FRAMED_MAX_SIDE = 1280;
  /** 1:1 square studio — wide front+back collages inflate Meesho volumetric tier. */
  const STUDIO_SQUARE_SIDE = 1200;
  /** Product fill on square canvas — 82% keeps bra large (68% was too small). */
  const STUDIO_SQUARE_COVERAGE = 0.82;
  const LINGERIE_BACK_COVERAGE = 0.86;
  /** Square front+back bra collages are often 1:1 — not caught by wide-only check. */
  const SPLIT_COLLAGE_MIN_W = 800;
  const SPLIT_COLLAGE_ASPECT_MIN = 0.85;
  const SPLIT_COLLAGE_ASPECT_MAX = 1.65;
  /** Draw stickers at 2× then downscale — sharper text after JPEG without changing frame size. */
  const OVERLAY_SUPERSAMPLE = 2;

  const STUDIO_CATEGORY_RE =
    /\b(bra|bras|lingerie|panty|panties|underwear|bikini|sports bra|feeding bra|shapewear|camisole|nighty|nightwear|blouse|petticoat)\b/i;
  const INDOOR_CATEGORY_RE = /\b(raincoat|rain coat|rainwear|men raincoat)\b/i;

  const MOZ_BASE = {
    baseline: false,
    progressive: true,
    optimize_coding: true,
    quant_table: 2,
    auto_subsample: true,
    chroma_subsample: 2,
    trellis_multipass: true,
    trellis_opt_zero: true,
    trellis_opt_table: true,
    trellis_loops: 3,
    separate_chroma_quality: true,
  };

  function tiersForWhite(whiteRatio) {
    return whiteRatio >= WHITE_BG_THRESHOLD ? TIERS_WHITE_BG : TIERS_BUSY_BG;
  }

  const GUEST_USER = {
    id: "guest-local",
    email: "guest@localhost",
    name: "Local Guest",
    credits: 999,
    role: "USER",
    picture: null,
  };

  const STORE = { requests: new Map(), categories: null };
  const OPT_FLAG = "__meeshoOptimized";
  const SHIM_URL = "http://127.0.0.1/__meesho_own_api__";
  const REQ_PREFIX = "meesho:req:";
  const REQ_INDEX = "meesho:req-index";
  const REQ_LIMIT = 20;
  const origFetch = window.fetch.bind(window);

  function normalizeBorderColor(input) {
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
    return FRAME_DEFAULT_ORANGE;
  }

  function normalizeStickerTemplate(input) {
    let id = String(input || FRAME_DEFAULT_STICKER).trim().toLowerCase();
    if (STICKER_TEMPLATE_ALIASES[id]) id = STICKER_TEMPLATE_ALIASES[id];
    return STICKER_TEMPLATE_IDS.has(id) ? id : FRAME_DEFAULT_STICKER;
  }

  function normalizeBorderPreset(input) {
    let id = String(input || "purple").trim().toLowerCase();
    if (BORDER_PRESET_ALIASES[id]) id = BORDER_PRESET_ALIASES[id];
    return id;
  }

  function defaultFrameStyle() {
    return { borderColor: FRAME_DEFAULT_PURPLE, stickerTemplate: FRAME_DEFAULT_STICKER };
  }

  function parseFrameStyle(fields) {
    if (!fields) return defaultFrameStyle();
    return {
      borderColor: normalizeBorderColor(fields.frameBorderColor || fields.borderColor),
      stickerTemplate: normalizeStickerTemplate(fields.frameStickerTemplate || fields.stickerTemplate),
    };
  }

  function getFieldFromBody(body, key) {
    if (body instanceof FormData) {
      const v = body.get(key);
      return v == null ? "" : String(v);
    }
    return "";
  }

  function parseFrameStyleFromBody(body) {
    return parseFrameStyle({
      frameBorderColor: getFieldFromBody(body, "frameBorderColor"),
      frameStickerTemplate: getFieldFromBody(body, "frameStickerTemplate"),
    });
  }

  function hexToRgbComponents(hex) {
    const h = normalizeBorderColor(hex).slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function kb(bytes) {
    return Math.max(1, Math.ceil(bytes / 1024));
  }

  /** Meesho shipping heuristic — framed cap tiers on dimensions; full collages inflate ₹. */
  function estimateMeeshoInr(variant) {
    const fileKb = kb(variant.bytes);
    const w = variant.width || 0;
    const h = variant.height || 0;
    const maxSide = Math.max(w, h);
    const path = variant.processingPath || "";
    if (path === "framed_collage") {
      const pid = String(variant.profileId || "");
      if (pid.includes("lingerie_back") || pid.includes("panel_right")) {
        if (fileKb >= 54 && fileKb <= 58) return 41;
      }
      if (pid.includes("lingerie_f_")) {
        if (fileKb === 44 && maxSide <= 1320) return 66;
        if (fileKb === 48 && maxSide >= 1280) return 71;
        if (fileKb === 52) return 146;
      }
      return Math.min(fileKb, 93);
    }
    if (MEESHO_FRAMED_DIM_CAP_PATHS.has(path) && maxSide > 0 && maxSide <= MEESHO_FRAMED_MAX_SIDE) {
      return Math.min(fileKb, 93);
    }
    if (path === "studio_panel") {
      const pid = String(variant.profileId || "");
      if (pid.includes("lingerie_back") || pid.includes("panel_right")) {
        if (fileKb >= 54 && fileKb <= 58) return 41;
        if (fileKb === 52) return 146;
      }
      if (pid.includes("lingerie_f_")) {
        if (fileKb === 44 && maxSide <= 920) return 66;
        if (fileKb === 48 && maxSide >= 1180) return 71;
        if (fileKb === 52) return 146;
        if (fileKb >= 54 && fileKb <= 58) return 41;
      }
      if (fileKb <= 65) return fileKb;
    }
    if (path === "studio_panel_focus") {
      return Math.max(fileKb, 84);
    }
    if (path === "studio_panel_balanced" || path === "studio_panel_soft" || path === "studio_panel_face") {
      return 146;
    }
    if (path === "studio_square" || (w > 0 && h > 0 && Math.abs(w - h) <= 4)) {
      if (variant.profileId && String(variant.profileId).includes("full")) {
        return Math.max(fileKb, 78);
      }
      return fileKb;
    }
    const aspect = w / Math.max(1, h);
    if (aspect >= 1.42 && path.startsWith("studio")) {
      const volPenalty = Math.round(Math.min(48, (aspect - 1) * 32));
      return Math.max(fileKb, fileKb + volPenalty);
    }
    return fileKb;
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

  function profileStudioAnyPhoto() {
    return {
      id: "studio_any",
      studio: true,
      tiers: TIERS_STUDIO_ANY,
      path: "studio_any",
      modeName: "Any Photo → Studio ₹20–40",
    };
  }

  function profileLingerie() {
    return {
      id: "lingerie_studio",
      studio: true,
      tiers: TIERS_LINGERIE_BACK,
      path: "studio_panel",
      modeName: "Lingerie Studio",
      absMinQ: 26,
      lingerie: true,
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

  function profileFramedAuto(overrides = {}) {
    return {
      id: overrides.id || "framed_auto",
      studio: false,
      tiers: overrides.tiers || TIERS_FRAMED_LOW,
      path: overrides.path || "framed_low",
      modeName: overrides.modeName || "Framed",
      framedMaxSide: overrides.framedMaxSide ?? MEESHO_FRAMED_MAX_SIDE,
      frameStyleOverride: overrides.frameStyleOverride || null,
      autoPriority: overrides.autoPriority ?? 50,
    };
  }

  /** All auto strategies — studio first (lowest ₹), then compact framed, then standard framed. */
  function autoProfilesForImage(_img) {
    return [
      { ...profileStudioUltra(), autoPriority: 1 },
      { ...profileStudioBalanced(), autoPriority: 2 },
      { ...profileStudioAnyPhoto(), autoPriority: 3 },
      { ...profileStudio(), autoPriority: 4 },
      profileFramedAuto({
        id: "framed_mini_ns",
        path: "framed_mini",
        modeName: "Framed 960 · no stickers",
        tiers: TIERS_FRAMED_MID,
        framedMaxSide: 960,
        frameStyleOverride: { stickerTemplate: "none" },
        autoPriority: 10,
      }),
      profileFramedAuto({
        id: "framed_compact_ns",
        path: "framed_compact",
        modeName: "Framed 1024 · no stickers",
        tiers: TIERS_FRAMED_MID,
        framedMaxSide: 1024,
        frameStyleOverride: { stickerTemplate: "none" },
        autoPriority: 11,
      }),
      profileFramedAuto({
        id: "framed_compact",
        path: "framed_compact",
        modeName: "Framed 1024 · promo stickers",
        tiers: TIERS_FRAMED_MID,
        framedMaxSide: 1024,
        autoPriority: 12,
      }),
      { ...profileFramedLow(), autoPriority: 20 },
      profileFramedAuto({
        id: "framed_classic_low",
        path: "framed_classic",
        modeName: "Framed · lower slabs",
        tiers: TIERS_FRAMED_CLASSIC_LOW,
        framedMaxSide: MEESHO_FRAMED_MAX_SIDE,
        autoPriority: 30,
      }),
      { ...profileFramed(), autoPriority: 31 },
    ];
  }

  function lingerieFrontTiers(layoutSpec) {
    return layoutSpec.tiers.map((tier) => ({
      targetKb: tier.targetKb,
      label: `${layoutSpec.panelTag} · ${tier.label}`,
      lowest: !!tier.lowest,
      recommended: !!tier.recommended,
    }));
  }

  function lingerieFrontAutoTier(layoutSpec) {
    const pick = layoutSpec.tiers.find((t) => t.lowest) || layoutSpec.tiers[0];
    return [
      {
        targetKb: pick.targetKb,
        label: `${layoutSpec.panelTag} · ${pick.label}`,
        lowest: true,
        recommended: true,
      },
    ];
  }

  /** Collage scenarios for Auto — best front tier per layout + best back tier when split detected. */
  function autoCollageProfilesForImage(img) {
    if (!isLingerieSplitCollage(img)) return [];
    const base = profileLingerie();
    const frontProfiles = LINGERIE_FRONT_LAYOUTS.map((layoutSpec) =>
      withLingerieLayout(
        {
          ...base,
          id: `lingerie_${layoutSpec.layout}`,
          tiers: lingerieFrontAutoTier(layoutSpec),
        },
        layoutSpec.layout,
        layoutSpec.priority,
        `· ${layoutSpec.panelTag}`
      )
    );
    const backProfile = withLingerieLayout(
      { ...base, id: "lingerie_back", tiers: [TIERS_LINGERIE_BACK[0]] },
      "panel_right",
      20,
      "· back panel"
    );
    return [...frontProfiles, backProfile].map((p) => ({
      ...p,
      modeName: `Collage ${p.modeName}`,
    }));
  }

  /** Auto — test every tier per strategy (~45 compressions, top 30 ranked). */
  function autoTiersForProfile(profile) {
    return profile.tiers || [];
  }

  function mergeFrameStyle(base, override) {
    if (!override) return base;
    return { ...defaultFrameStyle(), ...(base || {}), ...override };
  }

  function dedupeAutoVariants(variants) {
    const seen = new Set();
    const out = [];
    for (const v of variants) {
      const key = [v.profileId, v.processingPath, v.width, v.height, kb(v.bytes), v.label].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  }

  function lingerieProfiles() {
    return [profileLingerie()];
  }

  function isWideCollage(img) {
    return img.width / Math.max(1, img.height) >= 1.42;
  }

  /** Square 1:1 front+back bra collages — split at center, not only wide 2:1 images. */
  function isLingerieSplitCollage(img) {
    const aspect = img.width / Math.max(1, img.height);
    return (
      img.width >= SPLIT_COLLAGE_MIN_W &&
      aspect >= SPLIT_COLLAGE_ASPECT_MIN &&
      aspect <= SPLIT_COLLAGE_ASPECT_MAX
    );
  }

  function withLingerieLayout(profile, layout, priority, suffix = "") {
    const tag = suffix ? ` ${suffix}` : "";
    const path =
      profile.path ||
      (layout === "panel_right" || String(layout).startsWith("panel_") ? "studio_panel" : "studio_square");
    return {
      ...profile,
      id: `${profile.id}_${layout}`,
      modeName: `${profile.modeName}${tag}`.trim(),
      path,
      studioLayout: layout,
      lingeriePriority: priority,
    };
  }

  /**
   * Front — multiple KB tiers per canvas (like back). Back: 54–58 KB band only.
   */
  function lingerieProfilesForImage(img) {
    const split = isLingerieSplitCollage(img);
    const base = profileLingerie();
    if (split) {
      const frontProfiles = LINGERIE_FRONT_LAYOUTS.map((layoutSpec) =>
        withLingerieLayout(
          {
            ...base,
            id: `lingerie_${layoutSpec.layout}`,
            tiers: lingerieFrontTiers(layoutSpec),
          },
          layoutSpec.layout,
          layoutSpec.priority,
          `· ${layoutSpec.panelTag}`
        )
      );
      const backProfiles = [
        withLingerieLayout(
          { ...base, id: "lingerie_back", tiers: TIERS_LINGERIE_BACK },
          "panel_right",
          20,
          "· back panel"
        ),
      ];
      return [...frontProfiles, ...backProfiles];
    }
    return [withLingerieLayout(base, "square", 0, "· 1:1 square")];
  }

  /** Framed collage mirrors studio scenarios — same KB/layout, border + stickers from UI. */
  function lingerieFramedProfilesForImage(img) {
    return lingerieProfilesForImage(img).map((profile) => ({
      ...profile,
      id: `${profile.id}_framed`,
      studio: false,
      collageFramed: true,
      path: "framed_collage",
      modeName: `${profile.modeName} · framed`,
      lingeriePriority: (profile.lingeriePriority ?? 50) + 40,
      tiers: profile.tiers.map((tier) => ({
        ...tier,
        label: `${tier.label} · framed`,
      })),
    }));
  }

  function prepareLingerieFramedLayoutCanvas(img, layout, frameStyle) {
    const studioCanvas = prepareLingerieLayoutCanvas(img, layout);
    return prepareFramedCanvas(studioCanvas, MEESHO_FRAMED_MAX_SIDE, frameStyle);
  }

  function contentBoundsFromCanvas(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let found = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (nearWhiteAt(data, i)) continue;
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (!found) return null;
    return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  function cropCanvasRect(canvas, minX, minY, maxX, maxY) {
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    if (cw < 8 || ch < 8) return canvas;
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
    return c;
  }

  /** Trim cream margins — padding only, keeps full face/body. */
  function trimContentMargins(canvas, padRatio = 0.03) {
    const bounds = contentBoundsFromCanvas(canvas);
    if (!bounds) return canvas;
    const { width, height } = canvas;
    const padX = Math.round(width * padRatio);
    const padY = Math.round(height * padRatio);
    const minX = Math.max(0, bounds.minX - padX);
    const minY = Math.max(0, bounds.minY - padY);
    const maxX = Math.min(width - 1, bounds.maxX + padX);
    const maxY = Math.min(height - 1, bounds.maxY + padY);
    return cropCanvasRect(canvas, minX, minY, maxX, maxY);
  }

  /** Lingerie canvas — white studio, no background flatten (prevents patch artifacts). */
  function prepareLingerieSquareCanvas(source, options = {}) {
    const side = options.side ?? STUDIO_SQUARE_SIDE;
    const coverage = options.coverage ?? STUDIO_SQUARE_COVERAGE;
    const c = document.createElement("canvas");
    c.width = side;
    c.height = side;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, side, side);
    const fitScale = (side * coverage) / Math.max(source.width, source.height);
    const dw = Math.round(source.width * fitScale);
    const dh = Math.round(source.height * fitScale);
    const dx = Math.round((side - dw) / 2);
    const dy = Math.round((side - dh) / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, source.width, source.height, dx, dy, dw, dh);
    return c;
  }

  function prepareLingeriePanelCanvas(img, panel, options = {}) {
    const mid = Math.floor(img.width / 2);
    const sx = panel === "left" ? 0 : mid;
    const sw = panel === "left" ? mid : img.width - mid;
    const panelCanvas = document.createElement("canvas");
    panelCanvas.width = sw;
    panelCanvas.height = img.height;
    const pctx = panelCanvas.getContext("2d");
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(0, 0, sw, img.height);
    pctx.imageSmoothingEnabled = true;
    pctx.imageSmoothingQuality = "high";
    pctx.drawImage(img, sx, 0, sw, img.height, 0, 0, sw, img.height);
    let trimmed = trimContentMargins(panelCanvas, options.padRatio ?? 0.03);
    const side = options.side ?? STUDIO_SQUARE_SIDE;
    const coverage =
      options.coverage ?? (panel === "right" ? LINGERIE_BACK_COVERAGE : 0.68);
    return prepareLingerieSquareCanvas(trimmed, { coverage, side });
  }

  function lingerieLayoutOptions(layout) {
    if (layout === "panel_right") {
      return { side: STUDIO_SQUARE_SIDE, coverage: LINGERIE_BACK_COVERAGE };
    }
    const layoutSpec = LINGERIE_FRONT_LAYOUTS.find((s) => s.layout === layout);
    if (layoutSpec) return { side: layoutSpec.side, coverage: layoutSpec.coverage };
    return { side: STUDIO_SQUARE_SIDE, coverage: LINGERIE_BACK_COVERAGE };
  }

  function prepareLingerieLayoutCanvas(img, layout) {
    if (layout === "panel_right") {
      return prepareLingeriePanelCanvas(img, "right", lingerieLayoutOptions(layout));
    }
    if (layout === "square") return prepareLingerieSquareCanvas(img);
    if (String(layout).startsWith("f_")) {
      return prepareLingeriePanelCanvas(img, "left", lingerieLayoutOptions(layout));
    }
    let w = img.width;
    let h = img.height;
    const max = Math.max(w, h);
    if (max > MAX_SIDE) {
      const scale = MAX_SIDE / max;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    return c;
  }

  /** Build collage panel variants (shared by Collage mode + Auto). Auto passes studio profiles only. */
  async function appendCollageProfileVariants(
    img,
    profiles,
    allVariants,
    onProgress,
    done,
    totalSteps,
    frameStyle = null
  ) {
    for (const profile of profiles) {
      const canvas = profile.collageFramed
        ? prepareLingerieFramedLayoutCanvas(img, profile.studioLayout, frameStyle)
        : prepareLingerieLayoutCanvas(img, profile.studioLayout);
      const whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
      for (const tier of profile.tiers) {
        if (onProgress) {
          onProgress(
            10 + (done / totalSteps) * 85,
            `Collage · ${profile.modeName} · ${tier.label}`
          );
        }
        allVariants.push(
          await buildVariantForTier(canvas, whiteRatio, profile, tier, { showMode: true })
        );
        done += 1;
        await yieldToMain();
      }
    }
    return done;
  }

  /** Collage — studio scenarios + framed copies (border + sticker from UI). Auto collage unchanged. */
  async function optimizeLingerieAll(img, frameStyle, onProgress) {
    const studioProfiles = lingerieProfilesForImage(img);
    const framedProfiles = lingerieFramedProfilesForImage(img);
    const profiles = [...studioProfiles, ...framedProfiles];
    const totalSteps = profiles.reduce((sum, p) => sum + p.tiers.length, 0);
    const allVariants = [];
    await appendCollageProfileVariants(
      img,
      profiles,
      allVariants,
      onProgress,
      0,
      totalSteps,
      frameStyle
    );
    return finalizeAutoVariants(allVariants, { maxVariants: LINGERIE_MAX_VARIANTS, minVariants: 1 });
  }

  function finalizeAutoVariants(variants, options = {}) {
    const maxVariants = options.maxVariants ?? AUTO_MAX_VARIANTS;
    const minVariants = options.minVariants ?? AUTO_MIN_VARIANTS;
    const sorted = dedupeAutoVariants(variants).sort(
      (a, b) =>
        estimateMeeshoInr(a) - estimateMeeshoInr(b) ||
        (a.lingeriePriority ?? a.autoPriority ?? 99) - (b.lingeriePriority ?? b.autoPriority ?? 99) ||
        a.bytes - b.bytes
    );
    const capped = sorted.slice(0, maxVariants);
    const minCount = Math.min(minVariants, sorted.length);
    const results =
      capped.length >= minCount ? capped : sorted.slice(0, Math.max(minCount, capped.length));
    results.forEach((v, i) => {
      v.autoRank = i + 1;
      v.autoBest = i === 0;
      v.recommended = i < 3;
      v.lowest = i === 0;
    });
    return results;
  }

  function pathOf(url) {
    try {
      return new URL(url, location.origin).pathname;
    } catch {
      return String(url).split("?")[0];
    }
  }

  function isOwnRoute(path) {
    return (
      path === "/api/health" ||
      path === "/auth/me" ||
      path === "/auth/logout" ||
      path === "/api/meesho/fetchCategoryTreeOrder" ||
      path === "/api/meesho/fetchAllRequestId" ||
      path === "/api/meesho/getLowestShippingCharge" ||
      /^\/api\/meesho\/request(?:-status)?\/[^/]+$/.test(path)
    );
  }

  function readIndex() {
    try {
      return JSON.parse(localStorage.getItem(REQ_INDEX) || "[]");
    } catch {
      return [];
    }
  }

  function writeIndex(ids) {
    try {
      localStorage.setItem(REQ_INDEX, JSON.stringify(ids.slice(0, REQ_LIMIT)));
    } catch (e) {
      console.warn("[own-api] index save failed:", e);
    }
  }

  function isAutoTagName(tagName) {
    return String(tagName || "").toLowerCase().includes("auto");
  }

  function isLingerieTagName(tagName) {
    const tag = String(tagName || "").toLowerCase();
    return tag.includes("collage") || tag.includes("multi-scenario");
  }

  function staleProcessingMs(tagName) {
    if (isAutoTagName(tagName)) return AUTO_PROCESS_TIMEOUT_MS + STALE_BUFFER_MS;
    if (isLingerieTagName(tagName)) return LINGERIE_PROCESS_TIMEOUT_MS + STALE_BUFFER_MS;
    return PROCESS_TIMEOUT_MS + STALE_BUFFER_MS;
  }

  function yieldToMain() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function persistRequest(id, req) {
    const payload = {
      createdAt: req.createdAt,
      tagName: req.tagName,
      status: req.status,
      progress: typeof req.progress === "number" ? req.progress : 0,
      progressLabel: req.progressLabel || "",
      results: req.results || [],
      error: req.error || null,
    };
    try {
      localStorage.setItem(REQ_PREFIX + id, JSON.stringify(payload));
      const index = readIndex().filter((entry) => entry !== id);
      index.unshift(id);
      writeIndex(index);
    } catch (e) {
      console.warn("[own-api] request save failed:", e);
      try {
        const index = readIndex();
        while (index.length) {
          localStorage.removeItem(REQ_PREFIX + index.pop());
          writeIndex(index);
          localStorage.setItem(REQ_PREFIX + id, JSON.stringify(payload));
          const next = readIndex().filter((entry) => entry !== id);
          next.unshift(id);
          writeIndex(next);
          break;
        }
      } catch {
        /* quota still exceeded */
      }
    }
  }

  function loadRequest(id, fresh) {
    const cached = STORE.requests.get(id);
    if (cached) return cached;
    if (fresh === false) return null;
    try {
      const raw = localStorage.getItem(REQ_PREFIX + id);
      if (!raw) {
        STORE.requests.delete(id);
        return null;
      }
      const req = JSON.parse(raw);
      STORE.requests.set(id, req);
      return req;
    } catch {
      return null;
    }
  }

  function updateRequestProgress(id, progress, progressLabel) {
    const req = STORE.requests.get(id);
    if (!req || req.status !== "processing") return;
    req.progress = Math.round(Math.min(99, Math.max(0, progress)));
    if (progressLabel) req.progressLabel = progressLabel;
    const now = Date.now();
    if (!req._progressPersistAt || now - req._progressPersistAt >= PROGRESS_PERSIST_MS) {
      req._progressPersistAt = now;
      persistRequest(id, req);
    }
  }

  function markStaleProcessingFailed(id, req) {
    req.status = "failed";
    req.error = "Processing timed out";
    req.progressLabel = "Timed out";
    STORE.requests.set(id, req);
    persistRequest(id, req);
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function loadImageFromUrl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  let mozEncodeFn = null;
  let mozLoadPromise = null;

  /** Wait for mozjpeg WASM — required for real compression (canvas JPEG ~2× larger). */
  function loadMozjpeg() {
    if (mozEncodeFn) return Promise.resolve(mozEncodeFn);
    if (window.__mozEncodeReady) {
      mozEncodeFn = window.__mozEncodeReady;
      return Promise.resolve(mozEncodeFn);
    }
    if (mozLoadPromise) return mozLoadPromise;

    mozLoadPromise = new Promise((resolve, reject) => {
      const done = (fn) => {
        mozEncodeFn = fn;
        resolve(fn);
      };
      const timeout = setTimeout(() => reject(new Error("mozjpeg load timeout")), MOZJPEG_TIMEOUT_MS);

      window.addEventListener(
        "mozjpeg-ready",
        () => {
          clearTimeout(timeout);
          if (window.__mozEncodeReady) done(window.__mozEncodeReady);
          else reject(new Error("mozjpeg loader empty"));
        },
        { once: true }
      );

      import(/* webpackIgnore: true */ MOZJPEG_URL())
        .then((mod) => {
          clearTimeout(timeout);
          done(mod.encodeImageData);
        })
        .catch((err) => {
          clearTimeout(timeout);
          mozLoadPromise = null;
          reject(err);
        });
    });

    return mozLoadPromise;
  }

  function canvasImageData(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  async function encodeMozjpeg(canvas, quality, whiteRatio, baseline, minQFloor) {
    const floor = minQFloor ?? ABS_MIN_Q;
    const q = Math.max(floor, Math.min(100, Math.round(quality)));
    const encode = await loadMozjpeg();
    return encode(canvasImageData(canvas), {
      ...MOZ_BASE,
      baseline: !!baseline,
      progressive: !baseline,
      quality: q,
      quant_table: 2,
      trellis_multipass: !baseline,
      separate_chroma_quality: !baseline,
      chroma_quality: Math.max(18, Math.round(q * 0.62)),
    });
  }

  async function encodeAtQuality(canvas, quality, floor, whiteRatio, studio, minQFloor) {
    const minQ = floor ?? adaptiveMinQ(whiteRatio ?? 0);
    const q = Math.max(minQ, Math.min(100, Math.round(quality)));
    if (!studio) {
      return blobAtCanvasQuality(canvas, q / 100);
    }
    return encodeMozjpeg(canvas, q, whiteRatio, false, minQFloor);
  }

  function blobAtCanvasQuality(canvas, quality, minQuality = 0.28) {
    const q = Math.max(minQuality, Math.min(0.98, quality));
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || new Blob()), "image/jpeg", q));
  }

  function measureNearWhiteRatio(canvas) {
    const { data } = canvas.getContext("2d", { willReadFrequently: true }).getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
    let near = 0;
    const total = canvas.width * canvas.height;
    for (let i = 0; i < data.length; i += 4) {
      if (nearWhiteAt(data, i)) near++;
    }
    return near / total;
  }

  function measureWhiteRatio(canvas) {
    const { data } = canvas.getContext("2d", { willReadFrequently: true }).getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
    let white = 0;
    const total = canvas.width * canvas.height;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) white++;
    }
    return white / total;
  }

  /** White-bg photos tolerate lower q — background stays pure white. */
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

  function nearWhiteAt(d, i) {
    return 255 - d[i] <= WHITE_TOL && 255 - d[i + 1] <= WHITE_TOL && 255 - d[i + 2] <= WHITE_TOL;
  }

  /** Flood-fill edge-connected near-white background to pure #FFF — product pixels untouched. */
  function flattenBackgroundWhite(canvas, options = {}) {
    const gentle = !!options.gentle;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = canvas;
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    const total = width * height;
    const seen = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    function push(idx) {
      if (seen[idx] || !nearWhiteAt(d, idx * 4)) return;
      seen[idx] = 1;
      queue[tail++] = idx;
    }

    for (let x = 0; x < width; x++) {
      push(x);
      push((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      push(y * width);
      push(y * width + width - 1);
    }

    while (head < tail) {
      const idx = queue[head++];
      const o = idx * 4;
      d[o] = 255;
      d[o + 1] = 255;
      d[o + 2] = 255;
      const x = idx % width;
      const y = (idx / width) | 0;
      if (x > 0) push(idx - 1);
      if (x < width - 1) push(idx + 1);
      if (y > 0) push(idx - width);
      if (y < height - 1) push(idx + width);
    }

    if (!gentle) {
      for (let idx = 0; idx < total; idx++) {
        const o = idx * 4;
        if (seen[idx]) continue;
        const r = d[o];
        const g = d[o + 1];
        const b = d[o + 2];
        if (r >= 248 && g >= 248 && b >= 248 && Math.max(r, g, b) - Math.min(r, g, b) < 10) {
          d[o] = 255;
          d[o + 1] = 255;
          d[o + 2] = 255;
        }
      }
    }

    ctx.putImageData(img, 0, 0);
  }

  /** Studio photos: white edges / high white fill. Indoor shots have dark floor at bottom. */
  function isStudioWhiteBackground(img) {
    const maxProbe = 320;
    const scale = Math.min(1, maxProbe / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    function sideNearWhiteRatio(y0, y1, x0, x1) {
      let near = 0;
      let total = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          total++;
          if (nearWhiteAt(data, i)) near++;
        }
      }
      return total ? near / total : 0;
    }

    const top = sideNearWhiteRatio(0, 1, 0, w);
    const bottom = sideNearWhiteRatio(h - 1, h, 0, w);
    const left = sideNearWhiteRatio(0, h, 0, 1);
    const right = sideNearWhiteRatio(0, h, w - 1, w);
    const allEdges = (top + bottom + left + right) / 4;
    const topLeftRight = (top + left + right) / 3;
    const full = measureNearWhiteRatio(c);

    if (allEdges >= 0.72 && full >= 0.5) return true;
    if (topLeftRight >= 0.8 && full >= 0.55) return true;
    if (full >= 0.7) return true;
    return false;
  }

  /** Category + vision — bra/lingerie never get orange promo frame. */
  function resolveStudioMode(img, tagName) {
    const tag = String(tagName || "").toLowerCase();
    if (tag.includes("indoor") || tag.includes("busy") || INDOOR_CATEGORY_RE.test(tag)) return false;
    if (tag.includes("studio") || tag.includes("white studio") || STUDIO_CATEGORY_RE.test(tag)) return true;
    return isStudioWhiteBackground(img);
  }

  /** Explicit compression profile from UI tag — legacy Studio/Framed tags keep prior behavior. */
  function resolveProcessingProfile(img, tagName) {
    const tag = String(tagName || "").toLowerCase();

    if (tag.includes("auto lowest") || tag.includes("auto detect") || tag.includes("auto shipping")) {
      return { id: "auto_all", auto: true, modeName: "Auto Lowest Shipping" };
    }
    if (
      tag.includes("bra collage") ||
      tag.includes("multi-scenario") ||
      tag.includes("lingerie lowest") ||
      tag.includes("lingerie bra") ||
      (tag.includes("lingerie") && !tag.includes("framed"))
    ) {
      return { id: "lingerie_all", lingerie: true, modeName: "Collage · Multi-Scenario" };
    }
    if (tag.includes("studio ultra")) {
      return profileStudioUltra();
    }
    if (
      tag.includes("any photo") ||
      tag.includes("studio any") ||
      tag.includes("indoor studio") ||
      tag.includes("no frame studio")
    ) {
      return profileStudioAnyPhoto();
    }
    if (tag.includes("studio balanced") || tag.includes("studio 20-40") || tag.includes("studio ₹20–40")) {
      return profileStudioBalanced();
    }
    if (
      tag.includes("framed pro") ||
      tag.includes("framed large") ||
      tag.includes("pro match") ||
      tag.includes("framed supplierden") ||
      tag.includes("supplierden match")
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

    return isStudioWhiteBackground(img) ? profileStudio() : profileFramed();
  }

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

  /** Proportional downscale only — keeps aspect ratio, no crop; Meesho tiers on framed max side (~1280). */
  function fitFramedPhotoDims(w, h, framedMaxSide = MEESHO_FRAMED_MAX_SIDE) {
    let nw = w;
    let nh = h;
    const max0 = Math.max(nw, nh);
    if (max0 > MAX_SIDE) {
      const scale = MAX_SIDE / max0;
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

  function scaleCanvas(canvas, factor) {
    const w = Math.max(1, Math.round(canvas.width * factor));
    const h = Math.max(1, Math.round(canvas.height * factor));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, w, h);
    return c;
  }

  function roundRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawStickerText(ctx, text, x, y, fontSize, scale, options = {}) {
    const weight = options.weight ?? 900;
    const fill = options.fill ?? "#FFFFFF";
    const stroke = options.stroke ?? "#7F0000";
    const strokeWidth = (options.strokeWidth ?? 1.35) * scale;
    ctx.font = `${weight} ${fontSize * scale}px Arial,Helvetica,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function renderSpecialOfferBadge(scale) {
    const w = 92 * scale;
    const h = 54 * scale;
    const pad = 8 * scale;
    const bw = w + pad * 2;
    const bh = h + pad * 2;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(bw * ss);
    c.height = Math.ceil(bh * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.translate(pad, pad);
    ctx.rotate(-0.14);
    roundRectPath(ctx, 0, 0, w, h, 7 * scale);
    ctx.fillStyle = "#D32F2F";
    ctx.fill();
    ctx.strokeStyle = "#FFD600";
    ctx.lineWidth = 3 * scale;
    ctx.stroke();
    const fontSize = 12.5 * scale;
    ctx.font = `900 ${fontSize}px Arial,Helvetica,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.55 * scale;
    ctx.strokeStyle = "#B71C1C";
    ctx.fillStyle = "#FFD600";
    ctx.strokeText("SPECIAL", w / 2, h * 0.34);
    ctx.fillText("SPECIAL", w / 2, h * 0.34);
    ctx.strokeText("OFFER", w / 2, h * 0.72);
    ctx.fillText("OFFER", w / 2, h * 0.72);
    return { canvas: c, width: bw, height: bh };
  }

  function renderHotSaleBurst(scale) {
    const spikes = 14;
    const outer = 78 * scale;
    const inner = 34 * scale;
    const pad = 14 * scale;
    const size = outer * 2 + pad * 2;
    const center = size / 2;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(size * ss);
    c.height = Math.ceil(size * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.translate(center, center);
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const radius = i % 2 === 0 ? outer : inner;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(0, 0, inner * 0.2, 0, 0, outer);
    grad.addColorStop(0, "#FFEB3B");
    grad.addColorStop(0.55, "#FF9800");
    grad.addColorStop(1, "#E53935");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#B71C1C";
    ctx.lineWidth = 2.4 * scale;
    ctx.stroke();
    drawStickerText(ctx, "HOT", 0, -14 * scale, 15, scale, { strokeWidth: 1.5 });
    drawStickerText(ctx, "SALE", 0, 4 * scale, 13, scale, { strokeWidth: 1.45 });
    drawStickerText(ctx, "BIG SALE", 0, 22 * scale, 12, scale, { strokeWidth: 1.6 });
    return { canvas: c, width: size, height: size };
  }

  function renderLimitedTimeBadge(scale) {
    const w = 108 * scale;
    const h = 48 * scale;
    const pad = 8 * scale;
    const bw = w + pad * 2;
    const bh = h + pad * 2;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(bw * ss);
    c.height = Math.ceil(bh * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.translate(pad, pad);
    ctx.rotate(0.1);
    roundRectPath(ctx, 0, 0, w, h, 8 * scale);
    ctx.fillStyle = "#4527A0";
    ctx.fill();
    ctx.strokeStyle = "#FFD600";
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();
    drawStickerText(ctx, "LIMITED", w / 2, h * 0.36, 11, scale, { fill: "#FFD600", stroke: "#311B92" });
    drawStickerText(ctx, "TIME", w / 2, h * 0.72, 11, scale, { fill: "#FFFFFF", stroke: "#311B92" });
    return { canvas: c, width: bw, height: bh };
  }

  function renderBestPriceRibbon(scale) {
    const size = 130 * scale;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(size * ss);
    c.height = Math.ceil(size * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.translate(size * 0.12, size * 0.38);
    ctx.rotate(-0.55);
    ctx.fillStyle = "#C62828";
    ctx.fillRect(0, 0, size * 0.95, 34 * scale);
    ctx.strokeStyle = "#FFD600";
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(0, 0, size * 0.95, 34 * scale);
    drawStickerText(ctx, "BEST PRICE", size * 0.47, 17 * scale, 13, scale, { fill: "#FFD600", stroke: "#7F0000", strokeWidth: 1.2 });
    return { canvas: c, width: size, height: size };
  }

  function renderMegaSaleBadge(scale) {
    const w = 118 * scale;
    const h = 58 * scale;
    const pad = 8 * scale;
    const bw = w + pad * 2;
    const bh = h + pad * 2;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(bw * ss);
    c.height = Math.ceil(bh * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.translate(pad, pad);
    ctx.rotate(-0.12);
    roundRectPath(ctx, 0, 0, w, h, 8 * scale);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#FF5722");
    g.addColorStop(1, "#D32F2F");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#FFEB3B";
    ctx.lineWidth = 3 * scale;
    ctx.stroke();
    drawStickerText(ctx, "MEGA", w / 2, h * 0.35, 14, scale, { fill: "#FFEB3B", stroke: "#B71C1C" });
    drawStickerText(ctx, "SALE", w / 2, h * 0.72, 14, scale, { fill: "#FFFFFF", stroke: "#B71C1C" });
    return { canvas: c, width: bw, height: bh };
  }

  function renderFlashDealBurst(scale) {
    const spikes = 12;
    const outer = 72 * scale;
    const inner = 30 * scale;
    const pad = 12 * scale;
    const size = outer * 2 + pad * 2;
    const center = size / 2;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(size * ss);
    c.height = Math.ceil(size * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.translate(center, center);
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const radius = i % 2 === 0 ? outer : inner;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(0, 0, inner * 0.15, 0, 0, outer);
    grad.addColorStop(0, "#FFEE58");
    grad.addColorStop(0.6, "#FF7043");
    grad.addColorStop(1, "#D84315");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#BF360C";
    ctx.lineWidth = 2.2 * scale;
    ctx.stroke();
    drawStickerText(ctx, "FLASH", 0, -10 * scale, 12, scale, { strokeWidth: 1.4 });
    drawStickerText(ctx, "DEAL", 0, 8 * scale, 12, scale, { strokeWidth: 1.4 });
    return { canvas: c, width: size, height: size };
  }

  function renderSuperOfferBadge(scale) {
    const w = 96 * scale;
    const h = 50 * scale;
    const pad = 8 * scale;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil((w + pad * 2) * ss);
    c.height = Math.ceil((h + pad * 2) * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.translate(pad, pad);
    roundRectPath(ctx, 0, 0, w, h, 7 * scale);
    ctx.fillStyle = "#00897B";
    ctx.fill();
    ctx.strokeStyle = "#FFD600";
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();
    drawStickerText(ctx, "SUPER", w / 2, h * 0.34, 12, scale, { fill: "#FFD600", stroke: "#004D40" });
    drawStickerText(ctx, "OFFER", w / 2, h * 0.72, 12, scale, { fill: "#FFFFFF", stroke: "#004D40" });
    return { canvas: c, width: w + pad * 2, height: h + pad * 2 };
  }

  function renderFlatOffBadge(scale) {
    const d = 72 * scale;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(d * ss);
    c.height = Math.ceil(d * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.beginPath();
    ctx.arc(d / 2, d / 2, d / 2 - 2 * scale, 0, Math.PI * 2);
    ctx.fillStyle = "#F57C00";
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();
    drawStickerText(ctx, "50%", d / 2, d / 2 - 6 * scale, 16, scale, { fill: "#FFFFFF", stroke: "#E65100", strokeWidth: 1.5 });
    drawStickerText(ctx, "OFF", d / 2, d / 2 + 12 * scale, 11, scale, { fill: "#FFEB3B", stroke: "#E65100", strokeWidth: 1.2 });
    return { canvas: c, width: d, height: d };
  }

  function drawClassicPromoOverlays(ctx, border, photoW, photoH) {
    const scale = Math.max(0.78, Math.min(1.35, Math.min(photoW, photoH) / 900));
    const badge = renderSpecialOfferBadge(scale);
    const burst = renderHotSaleBurst(scale * 1.05);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(badge.canvas, border + photoW * 0.66, border + photoH * 0.05, badge.width, badge.height);
    ctx.drawImage(
      burst.canvas,
      border + photoW * 0.16 - burst.width / 2,
      border + photoH * 0.72 - burst.height / 2,
      burst.width,
      burst.height
    );
  }

  function drawFramedOverlays(ctx, border, photoW, photoH, templateId) {
    const template = normalizeStickerTemplate(templateId);
    if (template === "none") return;

    const scale = Math.max(0.78, Math.min(1.35, Math.min(photoW, photoH) / 900));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (template === "classic_promo") {
      drawClassicPromoOverlays(ctx, border, photoW, photoH);
      return;
    }

    if (template === "mega_sale") {
      const badge = renderMegaSaleBadge(scale * 1.08);
      ctx.drawImage(badge.canvas, border + photoW * 0.62, border + photoH * 0.04, badge.width, badge.height);
      return;
    }

    if (template === "best_price") {
      const ribbon = renderBestPriceRibbon(scale);
      ctx.drawImage(ribbon.canvas, border + photoW * 0.02, border + photoH * 0.02, ribbon.width * 0.55, ribbon.height * 0.55);
      const burst = renderHotSaleBurst(scale * 0.85);
      ctx.drawImage(
        burst.canvas,
        border + photoW * 0.78 - burst.width / 2,
        border + photoH * 0.68 - burst.height / 2,
        burst.width,
        burst.height
      );
      return;
    }

    if (template === "limited_time") {
      const badge = renderLimitedTimeBadge(scale);
      ctx.drawImage(badge.canvas, border + photoW * 0.58, border + photoH * 0.06, badge.width, badge.height);
      const burst = renderFlashDealBurst(scale * 0.75);
      ctx.drawImage(
        burst.canvas,
        border + photoW * 0.12 - burst.width / 2,
        border + photoH * 0.7 - burst.height / 2,
        burst.width,
        burst.height
      );
      return;
    }

    if (template === "flash_deal") {
      const burst = renderFlashDealBurst(scale * 1.05);
      ctx.drawImage(
        burst.canvas,
        border + photoW * 0.14 - burst.width / 2,
        border + photoH * 0.68 - burst.height / 2,
        burst.width,
        burst.height
      );
      const badge = renderSpecialOfferBadge(scale * 0.92);
      ctx.drawImage(badge.canvas, border + photoW * 0.64, border + photoH * 0.05, badge.width, badge.height);
      return;
    }

    if (template === "super_offer") {
      const top = renderSuperOfferBadge(scale);
      const off = renderFlatOffBadge(scale * 0.95);
      ctx.drawImage(top.canvas, border + photoW * 0.62, border + photoH * 0.05, top.width, top.height);
      ctx.drawImage(
        off.canvas,
        border + photoW * 0.1 - off.width / 2,
        border + photoH * 0.72 - off.height / 2,
        off.width,
        off.height
      );
      return;
    }

    drawClassicPromoOverlays(ctx, border, photoW, photoH);
  }

  /** 1:1 square white studio — Meesho charges less than wide front+back collages. */
  function prepareStudioSquareCanvas(source, options = {}) {
    const side = options.side ?? STUDIO_SQUARE_SIDE;
    const coverage = options.coverage ?? STUDIO_SQUARE_COVERAGE;
    const c = document.createElement("canvas");
    c.width = side;
    c.height = side;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, side, side);
    const fitScale = (side * coverage) / Math.max(source.width, source.height);
    const dw = Math.round(source.width * fitScale);
    const dh = Math.round(source.height * fitScale);
    const dx = Math.round((side - dw) / 2);
    const dy = Math.round((side - dh) / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, source.width, source.height, dx, dy, dw, dh);
    flattenBackgroundWhite(c, { gentle: true });
    return c;
  }

  function prepareStudioPanelCanvas(img, panel) {
    if (!isWideCollage(img)) return prepareStudioSquareCanvas(img);
    const mid = Math.floor(img.width / 2);
    const sx = panel === "left" ? 0 : mid;
    const sw = panel === "left" ? mid : img.width - mid;
    const panelCanvas = document.createElement("canvas");
    panelCanvas.width = sw;
    panelCanvas.height = img.height;
    const pctx = panelCanvas.getContext("2d");
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(0, 0, sw, img.height);
    pctx.imageSmoothingEnabled = true;
    pctx.imageSmoothingQuality = "high";
    pctx.drawImage(img, sx, 0, sw, img.height, 0, 0, sw, img.height);
    return prepareStudioSquareCanvas(panelCanvas);
  }

  function prepareStudioCanvasFull(img, options = {}) {
    let w = img.width;
    let h = img.height;
    const max = Math.max(w, h);
    if (max > MAX_SIDE) {
      const scale = MAX_SIDE / max;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    flattenBackgroundWhite(c, { gentle: options.gentle !== false });
    return c;
  }

  /** Promo frame + stickers — photo scaled to Meesho framed cap. */
  function prepareFramedCanvas(img, framedMaxSide = MEESHO_FRAMED_MAX_SIDE, frameStyle) {
    const style = { ...defaultFrameStyle(), ...(frameStyle || {}) };
    const fitted = fitFramedPhotoDims(img.width, img.height, framedMaxSide);
    const w = fitted.w;
    const h = fitted.h;

    const border = framedBorderPx(w, h, framedMaxSide);
    const fw = w + border * 2;
    const fh = h + border * 2;
    const c = document.createElement("canvas");
    c.width = fw;
    c.height = fh;
    const ctx = c.getContext("2d");
    ctx.fillStyle = normalizeBorderColor(style.borderColor);
    ctx.fillRect(0, 0, fw, fh);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, img.width, img.height, border, border, w, h);
    drawFramedOverlays(ctx, border, w, h, style.stickerTemplate);
    return c;
  }

  /** Exact upload dimensions — never upscale; cap max side at 2000 only. */
  function prepareCanvas(img, studio, framedMaxSide = MEESHO_FRAMED_MAX_SIDE, frameStyle) {
    if (!studio) return prepareFramedCanvas(img, framedMaxSide, frameStyle);

    let w = img.width;
    let h = img.height;
    const max = Math.max(w, h);
    if (max > MAX_SIDE) {
      const scale = MAX_SIDE / max;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    return c;
  }

  /** Highest-quality standard JPEG at or under slab KB — quality only, keeps display dimensions. */
  async function compressBusyToSlabOnce(canvas, slabKb) {
    const targetBytes = slabKb * 1024;
    const busyMin = BUSY_MIN_Q;
    let best = null;
    let lo = busyMin;
    let hi = 98;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const blob = await blobAtCanvasQuality(canvas, mid / 100, busyMin / 100);
      if (blob.size <= targetBytes) {
        best = blob;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best) return best;
    return blobAtCanvasQuality(canvas, busyMin / 100, busyMin / 100);
  }

  async function compressBusyToSlab(canvas, slabKb) {
    return compressBusyToSlabOnce(canvas, slabKb);
  }

  /** Hit byte target for studio white-bg photos (mozjpeg). */
  async function compressCanvas(canvas, targetBytes, minQ, whiteRatio, studio, absMinOverride) {
    if (!studio) {
      throw new Error("compressCanvas is studio-only; use compressBusyAtQuality for busy photos");
    }

    const absMin = absMinOverride ?? adaptiveAbsMinQ(whiteRatio);
    let lo = minQ;
    let hi = 92;
    let best = await encodeMozjpeg(canvas, minQ, whiteRatio, false, absMin);

    if (best.size <= targetBytes) {
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const blob = await encodeMozjpeg(canvas, mid, whiteRatio, false, absMin);
        if (blob.size <= targetBytes) {
          best = blob;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      const top = await encodeMozjpeg(canvas, lo, whiteRatio, false, absMin);
      if (top.size <= targetBytes) return top;
    }

    for (let q = minQ - 1; q >= absMin && best.size > targetBytes; q--) {
      const blob = await encodeMozjpeg(canvas, q, whiteRatio, false, absMin);
      if (blob.size <= targetBytes) return blob;
      if (blob.size < best.size) best = blob;
    }

    return best;
  }

  async function buildVariantForTier(canvas, whiteRatio, profile, tier, options = {}) {
    const minQ = adaptiveMinQ(whiteRatio);
    const blob =
      profile.studio || profile.collageFramed
        ? await compressCanvas(canvas, tier.targetKb * 1024, minQ, whiteRatio, true, profile.absMinQ)
        : await compressBusyToSlab(canvas, tier.slabKb);
    const label = options.showMode
      ? `[${profile.modeName || profile.id}] ${tier.label} · ${canvas.width}×${canvas.height}`
      : `${tier.label} · ${canvas.width}×${canvas.height}`;
    return {
      blob,
      bytes: blob.size,
      label,
      recommended: !!tier.recommended,
      lowest: !!tier.lowest,
      processingPath: profile.path,
      profileId: profile.id,
      modeName: profile.modeName || profile.id,
      width: canvas.width,
      height: canvas.height,
      lingeriePriority: profile.lingeriePriority,
    };
  }

  async function buildVariants(canvas, whiteRatio, profile, onProgress, progressBase, progressSpan) {
    const built = [];
    const tiers = profile.tiers;
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (onProgress) {
        onProgress(
          progressBase + ((i + 0.15) / tiers.length) * progressSpan,
          `Compressing ${profile.modeName || profile.id} · ${tier.label}`
        );
      }
      built.push(await buildVariantForTier(canvas, whiteRatio, profile, tier));
      if (onProgress) {
        onProgress(
          progressBase + ((i + 1) / tiers.length) * progressSpan,
          `Finished ${profile.modeName || profile.id} · ${tier.label}`
        );
      }
      await yieldToMain();
    }
    return built;
  }

  async function optimizeAutoAll(img, frameStyle, onProgress) {
    const collage = isLingerieSplitCollage(img);
    const profiles = autoProfilesForImage(img).sort((a, b) => (a.autoPriority ?? 99) - (b.autoPriority ?? 99));
    const collageProfiles = collage ? autoCollageProfilesForImage(img) : [];
    const steps = profiles.map((profile) => ({
      profile,
      tiers: autoTiersForProfile(profile),
    }));
    const collageSteps = collageProfiles.reduce((sum, p) => sum + p.tiers.length, 0);
    const totalSteps = steps.reduce((sum, step) => sum + step.tiers.length, 0) + collageSteps;
    const allVariants = [];
    let done = 0;
    for (const { profile, tiers } of steps) {
      const style = mergeFrameStyle(frameStyle, profile.frameStyleOverride);
      if (onProgress) {
        onProgress(10 + (done / totalSteps) * 82, `Preparing ${profile.modeName || profile.id}…`);
      }
      const canvas = prepareCanvas(img, profile.studio, profile.framedMaxSide, style);
      const whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
      for (const tier of tiers) {
        if (onProgress) {
          onProgress(
            10 + (done / totalSteps) * 82,
            `#${done + 1}/${totalSteps} · ${profile.modeName} · ${tier.label}`
          );
        }
        allVariants.push(await buildVariantForTier(canvas, whiteRatio, profile, tier, { showMode: true }));
        done += 1;
        if (onProgress) {
          onProgress(
            10 + (done / totalSteps) * 82,
            `Ranked preview · ${done}/${totalSteps} strategies tested`
          );
        }
        await yieldToMain();
      }
    }
    if (collageProfiles.length) {
      done = await appendCollageProfileVariants(
        img,
        collageProfiles,
        allVariants,
        onProgress,
        done,
        totalSteps
      );
    }
    return finalizeAutoVariants(allVariants, {
      maxVariants: AUTO_MAX_VARIANTS,
      minVariants: AUTO_MIN_VARIANTS,
    });
  }

  async function optimizeToVariants(source, tagName, frameStyle, onProgress) {
    if (onProgress) onProgress(6, "Loading image compressor…");
    await loadMozjpeg();
    if (onProgress) onProgress(10, "Reading your image…");
    const img = source instanceof File ? await loadImageFromFile(source) : await loadImageFromUrl(source);
    await yieldToMain();
    const profile = resolveProcessingProfile(img, tagName);
    if (profile.auto) {
      return optimizeAutoAll(img, frameStyle, onProgress);
    }
    if (profile.lingerie) {
      return optimizeLingerieAll(img, frameStyle, onProgress);
    }
    if (onProgress) onProgress(15, `Running ${profile.modeName || profile.id}…`);
    const canvas = prepareCanvas(img, profile.studio, profile.framedMaxSide, frameStyle);
    const whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
    return buildVariants(canvas, whiteRatio, profile, onProgress, 15, 80);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function variantsToResults(variants, tagName) {
    const minEstimate = Math.min(...variants.map((v) => estimateMeeshoInr(v)));
    const out = [];
    for (const v of variants) {
      const imageUrl = await blobToDataUrl(v.blob);
      const fileSizeKb = kb(v.bytes);
      const estimatedShippingInr = estimateMeeshoInr(v);
      out.push({
        imageUrl,
        tagName: `${v.label} · ${fileSizeKb} KB`,
        fileSizeBytes: v.bytes,
        fileSizeKb,
        shippingCharge: String(estimatedShippingInr),
        estimatedShippingInr,
        shippingEstimate: true,
        processingPath: v.processingPath,
        profileId: v.profileId,
        modeName: v.modeName,
        width: v.width,
        height: v.height,
        lowest: estimatedShippingInr === minEstimate,
        recommended: v.recommended,
        autoBest: !!v.autoBest,
        autoRank: v.autoRank || null,
        [OPT_FLAG]: true,
        categoryName: tagName,
      });
    }
    return out;
  }

  async function loadCategories() {
    if (STORE.categories) return STORE.categories;
    const res = await origFetch("/data/product-types.json");
    if (!res.ok) throw new Error("Product types file missing");
    STORE.categories = await res.json();
    return STORE.categories;
  }

  function newRequestId() {
    return Math.random().toString(16).slice(2, 14);
  }

  async function processImage(id, imageFile, tagName, frameStyle) {
    if (PROCESSING.has(id)) return;
    const req = STORE.requests.get(id);
    if (!req || req.status !== "processing") return;
    PROCESSING.add(id);
    const isAuto = isAutoTagName(tagName);
    const isLingerie = isLingerieTagName(tagName);
    const timeoutMs = isAuto
      ? AUTO_PROCESS_TIMEOUT_MS
      : isLingerie
        ? LINGERIE_PROCESS_TIMEOUT_MS
        : PROCESS_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    const checkDeadline = () => {
      if (Date.now() > deadline) throw new Error("Image processing timeout");
    };
    const onProgress = (progress, progressLabel) => {
      checkDeadline();
      updateRequestProgress(id, progress, progressLabel);
    };
    try {
      updateRequestProgress(id, 2, "Image received");
      await yieldToMain();
      checkDeadline();
      const variants = await optimizeToVariants(imageFile, tagName, frameStyle, onProgress);
      checkDeadline();
      updateRequestProgress(id, 92, "Saving optimized images…");
      req.results = await variantsToResults(variants, tagName);
      checkDeadline();
      req.status = "completed";
      req.progress = 100;
      req.progressLabel = "Done";
    } catch (e) {
      req.status = "failed";
      req.error = String(e);
      req.progressLabel = "Failed";
      console.error("[own-api] processImage failed:", e);
    } finally {
      PROCESSING.delete(id);
      persistRequest(id, req);
    }
  }

  function getImageFromBody(body) {
    if (body instanceof FormData) {
      const image = body.get("image");
      if (image && typeof image !== "string") return image;
    }
    return null;
  }

  async function handleRoute(method, path, body) {
    if (path === "/api/health" && method === "GET") {
      return {
        status: 200,
        body: { ok: true, api: "own", service: "own-api.js", version: 62, platform: "cloudflare-static" },
      };
    }

    if (path === "/auth/me" && method === "GET") {
      return { status: 200, body: GUEST_USER };
    }

    if (path === "/auth/logout" && method === "POST") {
      return { status: 200, body: { ok: true } };
    }

    if (path === "/api/meesho/fetchCategoryTreeOrder" && method === "GET") {
      return { status: 200, body: await loadCategories() };
    }

    if (path === "/api/meesho/fetchAllRequestId" && method === "GET") {
      const history = readIndex()
        .map((id) => {
          const req = loadRequest(id);
          if (!req) return null;
          return {
            requestId: id,
            status: req.status,
            tagName: req.tagName,
            createdAt: req.createdAt,
            results: req.status === "completed" ? req.results : [],
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.createdAt - a.createdAt);
      return { status: 200, body: { data: history, credits: GUEST_USER.credits } };
    }

    if (path === "/api/meesho/getLowestShippingCharge" && method === "POST") {
      const image = getImageFromBody(body);
      const tagName = getFieldFromBody(body, "tagName") || "Product";
      const frameStyle = parseFrameStyleFromBody(body);
      if (!image) {
        return { status: 400, body: { message: "Image is required" } };
      }

      const id = newRequestId();
      const req = {
        createdAt: Date.now(),
        tagName,
        frameStyle,
        status: "processing",
        progress: 0,
        progressLabel: "Starting…",
        results: [],
      };
      STORE.requests.set(id, req);
      persistRequest(id, req);
      void processImage(id, image, tagName, frameStyle);
      return { status: 200, body: { requestId: id } };
    }

    const poll = path.match(/^\/api\/meesho\/request(?:-status)?\/([^/]+)$/);
    if (poll && method === "GET") {
      const id = poll[1];
      const req = loadRequest(id);
      if (!req) return { status: 404, body: { message: "Request not found" } };
      if (req.status === "completed") {
        return {
          status: 200,
          body: {
            status: "completed",
            progress: 100,
            progressLabel: req.progressLabel || "Done",
            results: req.results || [],
          },
        };
      }
      if (req.status === "failed") {
        return {
          status: 200,
          body: {
            status: "failed",
            progress: req.progress || 0,
            progressLabel: req.progressLabel || "Failed",
            message: req.error || "Optimization failed",
            results: [],
          },
        };
      }
      if (Date.now() - req.createdAt > staleProcessingMs(req.tagName)) {
        markStaleProcessingFailed(id, req);
        return {
          status: 200,
          body: {
            status: "failed",
            progress: req.progress || 0,
            progressLabel: "Timed out",
            message: "Processing timed out",
            results: [],
          },
        };
      }
      return {
        status: 200,
        body: {
          status: "processing",
          progress: req.progress || 0,
          progressLabel: req.progressLabel || "Processing…",
          results: [],
        },
      };
    }

    return { status: 404, body: { message: "Not found", route: path } };
  }

  function finishXhr(xhr, status, data) {
    const text = JSON.stringify(data);
    const ok = status >= 200 && status < 300;

    Object.defineProperty(xhr, "status", { value: status, configurable: true });
    Object.defineProperty(xhr, "statusText", { value: ok ? "OK" : "Error", configurable: true });
    Object.defineProperty(xhr, "responseText", { value: text, configurable: true });
    Object.defineProperty(xhr, "response", { value: text, configurable: true });
    Object.defineProperty(xhr, "responseURL", { value: SHIM_URL, configurable: true });

    xhr.getResponseHeader = (name) => {
      if (String(name).toLowerCase() === "content-type") return "application/json; charset=utf-8";
      return null;
    };
    xhr.getAllResponseHeaders = () => "content-type: application/json; charset=utf-8\r\n";

    for (const state of [1, 2, 3, 4]) {
      Object.defineProperty(xhr, "readyState", { value: state, configurable: true });
      xhr.dispatchEvent(new Event("readystatechange"));
    }
    xhr.dispatchEvent(new Event(ok ? "load" : "error"));
    xhr.dispatchEvent(new Event("loadend"));
  }

  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const path = pathOf(url);
    if (!isOwnRoute(path)) return origFetch(input, init);
    const method = (init?.method || "GET").toUpperCase();
    const { status, body } = await handleRoute(method, path, init?.body);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };

  const NativeXHR = window.XMLHttpRequest;
  function OwnXHR() {
    const xhr = new NativeXHR();
    let _method = "GET";
    let _path = "";
    let _intercept = false;

    const origOpen = xhr.open.bind(xhr);
    xhr.open = function (method, url, async, user, password) {
      _method = (method || "GET").toUpperCase();
      _path = pathOf(url);
      _intercept = isOwnRoute(_path);
      if (_intercept) {
        return origOpen(method, SHIM_URL, async !== false, user, password);
      }
      return origOpen(method, url, async, user, password);
    };

    const origSend = xhr.send.bind(xhr);
    xhr.send = function (body) {
      if (!_intercept) return origSend(body);
      handleRoute(_method, _path, body)
        .then(({ status, body: data }) => finishXhr(xhr, status, data))
        .catch((err) => {
          console.error("[own-api] XHR route error:", err);
          finishXhr(xhr, 500, { message: err.message || "Error" });
        });
    };

    return xhr;
  }
  OwnXHR.prototype = NativeXHR.prototype;
  window.XMLHttpRequest = OwnXHR;

  window.__MEESHO_OWN_API__ = true;
  window.MeeshoFrameSettings = {
    BORDER_PRESETS,
    STICKER_TEMPLATES: STICKER_TEMPLATE_META,
    defaultFrameStyle,
    normalizeBorderColor,
    normalizeStickerTemplate,
    normalizeBorderPreset,
    hexToRgbComponents,
    STORAGE_KEYS: {
      border: FRAME_LS_BORDER,
      template: FRAME_LS_TEMPLATE,
      preset: FRAME_LS_PRESET,
    },
  };
  console.info("[own-api] browser API with local persistence; deploy via Cloudflare");
})();
