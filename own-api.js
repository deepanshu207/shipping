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
  /** SupplierDen parity — purple frame, capped dimensions, mid slabs targeting ~₹50 on Meesho. */
  const TIERS_SUPPLIERDEN_50 = [
    { slabKb: 48, label: "Lowest · SupplierDen ₹50 target", lowest: true },
    { slabKb: 50, label: "Recommended · ₹50 match", recommended: true },
    { slabKb: 52, label: "Balanced" },
    { slabKb: 55, label: "High detail backup" },
  ];
  /** Tight slabs for tall portrait / capped SupplierDen layouts (703×1024 band). */
  const TIERS_SUPPLIERDEN_TALL = [
    { slabKb: 44, label: "44KB · lowest try", lowest: true },
    { slabKb: 46, label: "46KB · low band" },
    { slabKb: 48, label: "48KB · ₹50 target", recommended: true },
    { slabKb: 49, label: "49KB" },
    { slabKb: 50, label: "50KB · match", recommended: true },
    { slabKb: 51, label: "51KB" },
    { slabKb: 52, label: "52KB" },
  ];
  const SUPPLIERDEN_MAX_VARIANTS = 56;
  const SUPPLIERDEN_PROCESS_TIMEOUT_MS = 420000;
  /** SupplierDen reference output — total canvas 703×1024 incl. thin purple frame (not inner+scale). */
  const SUPPLIERDEN_EXACT_OUTER_W = 703;
  const SUPPLIERDEN_EXACT_OUTER_H = 1024;
  const SUPPLIERDEN_EXACT_BORDER_PX = 10;
  /**
   * Exact outer dimensions matching SupplierDen — 703×1024 total, ~15% top / ~5% bottom / ~10% side margins.
   * Old portrait_framed + thick border scaled to 1024 produced ~724×1024 and still tiered ~₹79 on Meesho.
   */
  const SUPPLIERDEN_TALL_LAYOUTS = [
    {
      layout: "sd_exact703",
      type: "exact_framed",
      outerW: 703,
      outerH: 1024,
      borderPx: 10,
      topMarginRatio: 0.15,
      bottomMarginRatio: 0.05,
      sideMarginRatio: 0.1,
      priority: 0,
      panelTag: "703×1024 · ₹50 match",
      tiers: TIERS_SUPPLIERDEN_TALL,
    },
    {
      layout: "sd_exact703_tight",
      type: "exact_framed",
      outerW: 703,
      outerH: 1024,
      borderPx: 10,
      topMarginRatio: 0.12,
      bottomMarginRatio: 0.04,
      sideMarginRatio: 0.08,
      priority: 1,
      panelTag: "703×1024 · tight fill",
      tiers: TIERS_SUPPLIERDEN_TALL,
    },
    {
      layout: "sd_exact703_loose",
      type: "exact_framed",
      outerW: 703,
      outerH: 1024,
      borderPx: 10,
      topMarginRatio: 0.18,
      bottomMarginRatio: 0.06,
      sideMarginRatio: 0.12,
      priority: 2,
      panelTag: "703×1024 · loose fill",
      tiers: TIERS_SUPPLIERDEN_TALL,
    },
    {
      layout: "sd_exact703_b12",
      type: "exact_framed",
      outerW: 703,
      outerH: 1024,
      borderPx: 12,
      topMarginRatio: 0.15,
      bottomMarginRatio: 0.05,
      sideMarginRatio: 0.1,
      priority: 3,
      panelTag: "703×1024 · border 12",
      tiers: TIERS_SUPPLIERDEN_TALL,
    },
    {
      layout: "sd_exact680",
      type: "exact_framed",
      outerW: 680,
      outerH: 990,
      borderPx: 10,
      topMarginRatio: 0.15,
      bottomMarginRatio: 0.05,
      sideMarginRatio: 0.1,
      priority: 5,
      panelTag: "680×990",
      tiers: TIERS_SUPPLIERDEN_TALL,
    },
    {
      layout: "sd_exact640",
      type: "exact_framed",
      outerW: 640,
      outerH: 960,
      borderPx: 10,
      topMarginRatio: 0.15,
      bottomMarginRatio: 0.05,
      sideMarginRatio: 0.1,
      priority: 7,
      panelTag: "640×960",
      tiers: TIERS_SUPPLIERDEN_TALL,
    },
    {
      layout: "sd_exact600",
      type: "exact_framed",
      outerW: 600,
      outerH: 880,
      borderPx: 10,
      topMarginRatio: 0.14,
      bottomMarginRatio: 0.05,
      sideMarginRatio: 0.1,
      priority: 9,
      panelTag: "600×880",
      tiers: TIERS_SUPPLIERDEN_TALL,
    },
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
  /** Back — 52 KB hits ₹146 on Meesho; 54–58 KB band confirmed ~₹41. Never target 52. */
  const LINGERIE_BACK_KB_TIERS = [
    { targetKb: 55, label: "55KB · ~₹41", recommended: true, lowest: true, framedTargetKb: 50 },
    { targetKb: 54, label: "54KB · ~₹41", framedTargetKb: 49 },
    { targetKb: 56, label: "56KB", framedTargetKb: 51 },
    { targetKb: 57, label: "57KB", framedTargetKb: 52 },
    { targetKb: 58, label: "58KB", framedTargetKb: 53 },
  ];
  const TIERS_LINGERIE_BACK = LINGERIE_BACK_KB_TIERS;
  /**
   * Back layouts — multiple canvas sizes (like front) to land in 54–58 KB / ~₹41 band.
   * Smaller or looser fills help when 1200·86% overshoots to ~59 KB after split.
   */
  const LINGERIE_BACK_LAYOUTS = [
    {
      layout: "b_1200_std",
      priority: 20,
      side: 1200,
      coverage: 0.86,
      panelTag: "back 1200",
      tiers: LINGERIE_BACK_KB_TIERS,
    },
    {
      layout: "b_1200_compact",
      priority: 21,
      side: 1200,
      coverage: 0.78,
      panelTag: "back 1200 compact",
      tiers: LINGERIE_BACK_KB_TIERS,
    },
    {
      layout: "b_1000_mid",
      priority: 22,
      side: 1000,
      coverage: 0.84,
      panelTag: "back 1000",
      tiers: LINGERIE_BACK_KB_TIERS,
    },
    {
      layout: "b_1000_tight",
      priority: 23,
      side: 1000,
      coverage: 0.76,
      panelTag: "back 1000 tight",
      tiers: LINGERIE_BACK_KB_TIERS,
    },
    {
      layout: "b_900_std",
      priority: 24,
      side: 900,
      coverage: 0.88,
      panelTag: "back 900",
      tiers: LINGERIE_BACK_KB_TIERS,
    },
  ];
  const LINGERIE_BACK_FRAMED_MAX_SIDE = 1024;
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
  /**
   * Flat-lay apparel (tops, crop tops, tees) — multi-scenario grid targeting ₹39–₹51 band.
   * Model photos often land at 703×1024 framed · ~48–51 KB; flat-lays miss that without portrait + framed paths.
   */
  const FLATLAY_KB_TIERS_STUDIO = [
    { targetKb: 39, label: "39KB · ~₹39", lowest: true },
    { targetKb: 41, label: "41KB · ~₹41" },
    { targetKb: 49, label: "49KB · ~₹49", recommended: true },
    { targetKb: 51, label: "51KB · ~₹51" },
  ];
  const FLATLAY_KB_TIERS_FRAMED = [
    { slabKb: 48, label: "48KB · ~₹48", lowest: true },
    { slabKb: 49, label: "49KB · ~₹49" },
    { slabKb: 51, label: "51KB · ~₹51", recommended: true },
    { slabKb: 39, label: "39KB try" },
    { slabKb: 41, label: "41KB try" },
  ];
  const FLATLAY_PORTRAIT_W = 703;
  const FLATLAY_PORTRAIT_H = 1024;
  const FLATLAY_MAX_VARIANTS = 56;
  const FLATLAY_PROCESS_TIMEOUT_MS = 360000;
  /** Model / on-person photos — native aspect + framed 1024 (no forced square→portrait). */
  const MODEL_PHOTO_MAX_VARIANTS = 36;
  const MODEL_PHOTO_PROCESS_TIMEOUT_MS = 300000;
  const MODEL_PHOTO_LAYOUTS = [
    {
      layout: "m_f1024_ns",
      type: "native_framed",
      framedMaxSide: 1024,
      noStickers: true,
      priority: 0,
      panelTag: "framed 1024 · no stickers",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "m_f1024",
      type: "native_framed",
      framedMaxSide: 1024,
      priority: 5,
      panelTag: "framed 1024 · promo",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "m_f960_ns",
      type: "native_framed",
      framedMaxSide: 960,
      noStickers: true,
      priority: 10,
      panelTag: "framed 960 · no stickers",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "m_p703_ns",
      type: "portrait_framed",
      portraitW: FLATLAY_PORTRAIT_W,
      portraitH: FLATLAY_PORTRAIT_H,
      coverage: 0.88,
      framedMaxSide: 1024,
      noStickers: true,
      priority: 12,
      panelTag: "portrait 703×1024 framed",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "m_native_studio",
      type: "native_studio",
      priority: 18,
      panelTag: "studio trimmed",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "m_p703_studio",
      type: "portrait_studio",
      portraitW: FLATLAY_PORTRAIT_W,
      portraitH: FLATLAY_PORTRAIT_H,
      coverage: 0.86,
      priority: 22,
      panelTag: "portrait 703×1024 studio",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
  ];
  /** Full-length / enlarged (dress, kaftan, saree) — fit tall body into capped 703×1024 / 580×900 canvases. */
  const FULL_LENGTH_MAX_VARIANTS = 52;
  const FULL_LENGTH_PROCESS_TIMEOUT_MS = 360000;
  const FULL_LENGTH_LAYOUTS = [
    {
      layout: "fl_fp703_ns",
      type: "portrait_framed",
      portraitW: FLATLAY_PORTRAIT_W,
      portraitH: FLATLAY_PORTRAIT_H,
      coverage: 0.72,
      framedMaxSide: 1024,
      noStickers: true,
      priority: 0,
      panelTag: "fit 703×1024 framed",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "fl_p703",
      type: "portrait_studio",
      portraitW: FLATLAY_PORTRAIT_W,
      portraitH: FLATLAY_PORTRAIT_H,
      coverage: 0.72,
      priority: 5,
      panelTag: "fit 703×1024 studio",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "fl_fp703",
      type: "portrait_framed",
      portraitW: FLATLAY_PORTRAIT_W,
      portraitH: FLATLAY_PORTRAIT_H,
      coverage: 0.7,
      framedMaxSide: 1024,
      priority: 8,
      panelTag: "fit 703×1024 + stickers",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "fl_p580",
      type: "portrait_studio",
      portraitW: 580,
      portraitH: 900,
      coverage: 0.74,
      priority: 12,
      panelTag: "fit 580×900 studio",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "fl_fp580_ns",
      type: "portrait_framed",
      portraitW: 580,
      portraitH: 900,
      coverage: 0.72,
      framedMaxSide: 960,
      noStickers: true,
      priority: 15,
      panelTag: "fit 580×900 framed",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "fl_cap1024",
      type: "native_capped_studio",
      capMaxSide: 1024,
      priority: 18,
      panelTag: "capped 1024 studio",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "fl_cap1024_f",
      type: "native_capped_framed",
      capMaxSide: 1024,
      framedMaxSide: 1024,
      noStickers: true,
      priority: 20,
      panelTag: "capped 1024 framed",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "fl_cap960_f",
      type: "native_capped_framed",
      capMaxSide: 960,
      framedMaxSide: 960,
      noStickers: true,
      priority: 25,
      panelTag: "capped 960 framed",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "fl_p620",
      type: "portrait_studio",
      portraitW: 620,
      portraitH: 900,
      coverage: 0.68,
      priority: 28,
      panelTag: "fit 620×900 tight",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "fl_p703_loose",
      type: "portrait_studio",
      portraitW: FLATLAY_PORTRAIT_W,
      portraitH: FLATLAY_PORTRAIT_H,
      coverage: 0.78,
      priority: 32,
      panelTag: "fit 703 loose studio",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
  ];
  const FLATLAY_LAYOUTS = [
    {
      layout: "fp_703_ns",
      type: "portrait_framed",
      portraitW: FLATLAY_PORTRAIT_W,
      portraitH: FLATLAY_PORTRAIT_H,
      coverage: 0.9,
      framedMaxSide: 1024,
      noStickers: true,
      priority: 0,
      panelTag: "portrait 703×1024 framed",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "fp_703",
      type: "portrait_framed",
      portraitW: FLATLAY_PORTRAIT_W,
      portraitH: FLATLAY_PORTRAIT_H,
      coverage: 0.88,
      framedMaxSide: 1024,
      priority: 8,
      panelTag: "portrait 703×1024 + stickers",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "p_703_std",
      type: "portrait_studio",
      portraitW: FLATLAY_PORTRAIT_W,
      portraitH: FLATLAY_PORTRAIT_H,
      coverage: 0.9,
      priority: 5,
      panelTag: "portrait 703×1024 studio",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "native_f1024_ns",
      type: "native_framed",
      framedMaxSide: 1024,
      noStickers: true,
      priority: 12,
      panelTag: "native · framed 1024",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "sq_900",
      type: "square_studio",
      side: 900,
      coverage: 0.8,
      priority: 20,
      panelTag: "square 900",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "sq_1000",
      type: "square_studio",
      side: 1000,
      coverage: 0.78,
      priority: 25,
      panelTag: "square 1000",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "sq_1200",
      type: "square_studio",
      side: 1200,
      coverage: 0.72,
      priority: 30,
      panelTag: "square 1200",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "fsq_900_ns",
      type: "square_framed",
      side: 900,
      coverage: 0.8,
      framedMaxSide: 1024,
      noStickers: true,
      priority: 18,
      panelTag: "square 900 · framed 1024",
      tiers: FLATLAY_KB_TIERS_FRAMED,
    },
    {
      layout: "p_620_900",
      type: "portrait_studio",
      portraitW: 620,
      portraitH: 900,
      coverage: 0.86,
      priority: 35,
      panelTag: "portrait 620×900",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "native_studio",
      type: "native_studio",
      priority: 40,
      panelTag: "native trimmed studio",
      tiers: FLATLAY_KB_TIERS_STUDIO,
    },
    {
      layout: "native_f960_ns",
      type: "native_framed",
      framedMaxSide: 960,
      noStickers: true,
      priority: 45,
      panelTag: "native · framed 960",
      tiers: FLATLAY_KB_TIERS_FRAMED,
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
  const LINGERIE_MAX_VARIANTS = 72;
  const LINGERIE_PROCESS_TIMEOUT_MS = 360000;
  const AUTO_PROCESS_TIMEOUT_MS = 540000;
  const PROCESS_TIMEOUT_MS = 180000;
  const STALE_BUFFER_MS = 30000;
  const PROGRESS_PERSIST_MS = 400;
  const PROCESSING = new Set();
  let yieldCounter = 0;
  const MOZJPEG_URL = () => new URL("/vendor/mozjpeg.mjs", location.origin).href;
  const FRAME_DEFAULT_ORANGE = "#FF7900";
  const FRAME_DEFAULT_PURPLE = "#7C3AED";
  const FRAME_DEFAULT_STICKER = "limited_time";
  const FRAME_LS_BORDER = "meesho_frame_border_color";
  const FRAME_LS_TEMPLATE = "meesho_frame_sticker_template";
  const FRAME_LS_PRESET = "meesho_frame_border_preset";
  const BORDER_WIDTH_PRESETS = [
    { id: "thin", name: "Thin border", scale: 0.55 },
    { id: "standard", name: "Standard", scale: 1 },
    { id: "thick", name: "Thick border", scale: 1.35 },
  ];
  const BORDER_WIDTH_PRESET_IDS = new Set(BORDER_WIDTH_PRESETS.map((p) => p.id));
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
    { id: "none", name: "Frame only", desc: "No promotion stickers" },
    { id: "mega_sale", name: "Mega Sale", desc: "Large MEGA SALE badge" },
    { id: "best_price", name: "Best Price", desc: "BEST PRICE corner ribbon" },
    { id: "limited_time", name: "Limited Time", desc: "LIMITED TIME urgency tag" },
    { id: "flash_deal", name: "Flash Deal", desc: "FLASH DEAL star burst" },
    { id: "super_offer", name: "Super Offer", desc: "SUPER OFFER + 50% OFF" },
  ];
  const STICKER_TEMPLATE_IDS = new Set(STICKER_TEMPLATE_META.map((t) => t.id));
  const STICKER_TEMPLATE_ALIASES = { supplierden: "supplierden_match", supplierden_one_sticker: "supplierden_one" };
  const BORDER_PRESET_ALIASES = { supplierden: "purple" };
  const SUPPLIERDEN_MATCH_PURPLE = "#7C3AED";
  const FRAME_BORDER_RATIO = 0.048;
  const FRAME_MIN_BORDER = 34;
  const MEESHO_FRAMED_DIM_CAP_PATHS = new Set([
    "framed_classic",
    "framed_pro",
    "framed_low",
    "framed_mid",
    "framed_compact",
    "framed_mini",
    "flatlay_framed",
    "model_framed",
    "full_length_framed",
    "supplierden",
    "supplierden_heavy",
    "supplierden_match_50",
  ]);
  /** Meesho may tier on max framed side — pro sellers often cap near 1280px. */
  const MEESHO_FRAMED_MAX_SIDE = 1280;
  /** 1:1 square studio — wide front+back collages inflate Meesho volumetric tier. */
  const STUDIO_SQUARE_SIDE = 1200;
  /** Product fill on square canvas — 82% keeps bra large (68% was too small). */
  const STUDIO_SQUARE_COVERAGE = 0.82;
  const LINGERIE_BACK_COVERAGE = 0.86;
  /** Square or 2:1 front+back bra collages — split at center. */
  const SPLIT_COLLAGE_MIN_MAX_SIDE = 560;
  const SPLIT_COLLAGE_MIN_MIN_SIDE = 300;
  const SPLIT_COLLAGE_COLLAGE_MODE_MIN_MAX = 280;
  const SPLIT_COLLAGE_COLLAGE_MODE_MIN_MIN = 150;
  const SPLIT_COLLAGE_ASPECT_MIN = 0.85;
  const SPLIT_COLLAGE_ASPECT_MAX = 2.5;
  const SPLIT_COLLAGE_WIDE_ASPECT = 1.18;
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
  let useServerProcessing = false;

  function isProcessingRoute(path) {
    return (
      path === "/api/meesho/getLowestShippingCharge" ||
      /^\/api\/meesho\/request(?:-status)?\/[^/]+$/.test(path) ||
      /^\/api\/meesho\/cancel-request\/[^/]+$/.test(path)
    );
  }

  async function initApiMode() {
    if (window.__MEESHO_FORCE_CLIENT__) return;
    if (window.__MEESHO_PROCESSOR_ORIGIN__) {
      useServerProcessing = true;
      return;
    }
    try {
      const res = await origFetch("/api/health", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.processing === "server") useServerProcessing = true;
    } catch {
      /* client fallback */
    }
  }

  async function optimizeForServer(imageDataUrl, tagName, frameStyleInput, onProgress) {
    await loadMozjpeg();
    const frameStyle = parseFrameStyle(frameStyleInput || {});
    const blob = await fetch(imageDataUrl).then((r) => r.blob());
    const file = new File([blob], "upload.jpg", { type: blob.type || "image/jpeg" });
    const variants = await optimizeToVariants(file, tagName, frameStyle, onProgress || (() => {}));
    return variantsToResults(variants, tagName);
  }

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

  function normalizeBorderWidthPreset(input) {
    const id = String(input || "standard").trim().toLowerCase();
    return BORDER_WIDTH_PRESET_IDS.has(id) ? id : "standard";
  }

  function normalizeBorderWidthAdjust(input) {
    const n = Number(input);
    if (!Number.isFinite(n)) return 100;
    return Math.min(140, Math.max(60, Math.round(n)));
  }

  function resolveBorderWidthScale(frameStyle) {
    const style = frameStyle || {};
    const preset = BORDER_WIDTH_PRESETS.find((p) => p.id === normalizeBorderWidthPreset(style.borderWidthPreset)) ||
      BORDER_WIDTH_PRESETS.find((p) => p.id === "standard");
    const adjust = normalizeBorderWidthAdjust(style.borderWidthAdjust ?? 100);
    return Math.max(0.35, Math.min(1.75, preset.scale * (adjust / 100)));
  }

  function defaultFrameStyle() {
    return {
      borderColor: FRAME_DEFAULT_PURPLE,
      stickerTemplate: FRAME_DEFAULT_STICKER,
      borderWidthPreset: "standard",
      borderWidthAdjust: 100,
    };
  }

  function parseFrameStyle(fields) {
    if (!fields) return defaultFrameStyle();
    const style = {
      borderColor: normalizeBorderColor(fields.frameBorderColor || fields.borderColor),
      stickerTemplate: normalizeStickerTemplate(fields.frameStickerTemplate || fields.stickerTemplate),
      borderWidthPreset: normalizeBorderWidthPreset(fields.borderWidthPreset),
      borderWidthAdjust: normalizeBorderWidthAdjust(fields.borderWidthAdjust ?? 100),
    };
    if (fields.stickerLayout) {
      style.stickerLayout = fields.stickerLayout;
    }
    return style;
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

  function isLingerieBackProfileId(pid) {
    const id = String(pid || "");
    return id.includes("lingerie_back") || id.includes("panel_right") || id.includes("lingerie_b_");
  }

  function isLingerieBackLayout(layout, profileId) {
    const lid = String(layout || "");
    return lid === "panel_right" || lid.startsWith("b_") || isLingerieBackProfileId(profileId);
  }

  /** Meesho shipping heuristic — framed cap tiers on dimensions; full collages inflate ₹. */
  function estimateMeeshoInr(variant) {
    const fileKb = kb(variant.bytes);
    const w = variant.width || 0;
    const h = variant.height || 0;
    const maxSide = Math.max(w, h);
    const path = variant.processingPath || "";
    const pid = String(variant.profileId || "");
    const backPanel = isLingerieBackProfileId(pid);
    if (path === "supplierden_match_50") {
      if (maxSide > 0 && maxSide <= 1024 && fileKb >= 37 && fileKb <= 55) return Math.min(fileKb, 50);
      if (maxSide > 1024 && maxSide <= MEESHO_FRAMED_MAX_SIDE) return Math.min(fileKb, 79);
      return Math.min(fileKb, 50);
    }
    if (path === "framed_collage") {
      if (backPanel) {
        if (fileKb >= 53 && fileKb <= 58) return 41;
        if (fileKb === 52) return 146;
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
      if (backPanel) {
        if (fileKb >= 53 && fileKb <= 58) return 41;
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
      if (pid.includes("flatlay_")) {
        if (fileKb >= 37 && fileKb <= 44) return fileKb <= 40 ? 39 : 41;
        if (fileKb <= 65) return fileKb;
      }
      return fileKb;
    }
    if (path === "flatlay_portrait" || path === "flatlay_square") {
      if (fileKb >= 37 && fileKb <= 44) return fileKb <= 40 ? 39 : 41;
      if (fileKb <= 65) return fileKb;
    }
    if (path === "model_portrait" || path === "model_framed") {
      if (fileKb <= 65) return fileKb;
    }
    if (path === "full_length_portrait" || path === "full_length_framed") {
      if (fileKb >= 37 && fileKb <= 44) return fileKb <= 40 ? 39 : 41;
      if (maxSide > 0 && maxSide <= 1024 && fileKb <= 65) return fileKb;
      if (fileKb <= 65) return fileKb;
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

  function profileFlatlayApparel() {
    return {
      id: "flatlay_studio",
      studio: true,
      tiers: FLATLAY_KB_TIERS_STUDIO,
      path: "flatlay_portrait",
      modeName: "Flat-Lay Apparel",
      absMinQ: 22,
      flatlayApparel: true,
    };
  }

  function profileModelPhoto() {
    return {
      id: "model_studio",
      studio: true,
      tiers: FLATLAY_KB_TIERS_STUDIO,
      path: "model_portrait",
      modeName: "Model Photo",
      absMinQ: 22,
      modelPhoto: true,
    };
  }

  function profileFullLength() {
    return {
      id: "full_length_studio",
      studio: true,
      tiers: FLATLAY_KB_TIERS_STUDIO,
      path: "full_length_portrait",
      modeName: "Full-Length",
      absMinQ: 22,
      fullLength: true,
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

  /** SupplierDen-style: purple frame, FREE DELIVERY + BEST CHOICE stickers, multi tall layouts. */
  function profileSupplierDenMatch() {
    return {
      id: "supplierden_match",
      studio: false,
      supplierDenExclusive: true,
      supplierDenAll: true,
      tiers: TIERS_SUPPLIERDEN_50,
      path: "supplierden_match_50",
      modeName: "Tall ₹50",
      framedMaxSide: 1024,
    };
  }

  function resolveSupplierDenFrameStyle(frameStyle, tagName) {
    const user = parseFrameStyle(frameStyle || {});
    let stickerTemplate = normalizeStickerTemplate(user.stickerTemplate);
    if (isSupplierDenOneStickerTagName(tagName)) {
      stickerTemplate = "supplierden_one";
    }
    return {
      borderColor: normalizeBorderColor(user.borderColor),
      stickerTemplate,
    };
  }

  function withSupplierDenLayout(layoutSpec) {
    const base = profileSupplierDenMatch();
    return {
      ...base,
      id: `supplierden_${layoutSpec.layout}`,
      modeName: `Tall · ${layoutSpec.panelTag || layoutSpec.layout}`,
      studio: false,
      supplierDenAll: false,
      path: "supplierden_match_50",
      studioLayout: layoutSpec.layout,
      flatlaySpec: layoutSpec,
      flatlayPriority: layoutSpec.priority ?? 50,
      framedMaxSide: layoutSpec.framedMaxSide ?? layoutSpec.outerH ?? 1024,
      tiers: layoutSpec.tiers || TIERS_SUPPLIERDEN_TALL,
    };
  }

  function supplierDenProfilesForImage() {
    return SUPPLIERDEN_TALL_LAYOUTS.map((layoutSpec) => withSupplierDenLayout(layoutSpec)).sort(
      (a, b) => (a.flatlayPriority ?? 99) - (b.flatlayPriority ?? 99)
    );
  }

  async function optimizeSupplierDenAll(img, frameStyle, onProgress, tagName) {
    const profiles = supplierDenProfilesForImage();
    const activeStyle = resolveSupplierDenFrameStyle(frameStyle, tagName);
    const totalSteps = profiles.reduce((sum, p) => sum + p.tiers.length, 0);
    const allVariants = [];
    let done = 0;
    for (const profile of profiles) {
      const canvas = prepareSupplierDenLayoutCanvas(img, profile.flatlaySpec, activeStyle);
      const whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
      for (const tier of profile.tiers) {
        if (onProgress) {
          onProgress(
            10 + (done / totalSteps) * 85,
            `Tall dress · ${profile.modeName} · ${tier.label}`
          );
        }
        allVariants.push(
          await buildVariantForTier(canvas, whiteRatio, profile, tier, {
            showMode: true,
            reframeMeta: buildReframeMeta(profile, tier, {
              frameStyle: activeStyle,
              studioLayout: profile.studioLayout,
              whiteRatio,
            }),
          })
        );
        done += 1;
        await yieldToMain();
      }
      releaseCanvas(canvas);
    }
    return finalizeSupplierDenVariants(allVariants, {
      maxVariants: SUPPLIERDEN_MAX_VARIANTS,
      minVariants: 1,
    });
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
      framedTargetKb: tier.framedTargetKb,
      label: `${layoutSpec.panelTag} · ${tier.label}`,
      lowest: !!tier.lowest,
      recommended: !!tier.recommended,
    }));
  }

  function lingerieBackTiers(layoutSpec) {
    return layoutSpec.tiers.map((tier) => ({
      targetKb: tier.targetKb,
      framedTargetKb: tier.framedTargetKb,
      label: `${layoutSpec.panelTag} · ${tier.label}`,
      lowest: !!tier.lowest,
      recommended: !!tier.recommended,
    }));
  }

  function lingerieBackAutoTier(layoutSpec) {
    const pick = layoutSpec.tiers.find((t) => t.lowest) || layoutSpec.tiers[0];
    return [
      {
        targetKb: pick.targetKb,
        framedTargetKb: pick.framedTargetKb,
        label: `${layoutSpec.panelTag} · ${pick.label}`,
        lowest: true,
        recommended: true,
      },
    ];
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
    const backProfiles = LINGERIE_BACK_LAYOUTS.map((layoutSpec) =>
      withLingerieLayout(
        {
          ...base,
          id: `lingerie_${layoutSpec.layout}`,
          tiers: lingerieBackAutoTier(layoutSpec),
        },
        layoutSpec.layout,
        layoutSpec.priority,
        `· ${layoutSpec.panelTag}`
      )
    );
    return [...frontProfiles, ...backProfiles].map((p) => ({
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

  function collageSampleCanvas(img, sampleW = 320) {
    const sampleH = Math.max(100, Math.round((sampleW * img.height) / Math.max(1, img.width)));
    const c = document.createElement("canvas");
    c.width = sampleW;
    c.height = sampleH;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sampleW, sampleH);
    ctx.drawImage(img, 0, 0, sampleW, sampleH);
    return { canvas: c, sampleW, sampleH, data: ctx.getImageData(0, 0, sampleW, sampleH).data };
  }

  /** Cream/off-white studio backgrounds — compare pixels to edge estimate, not pure white. */
  function estimateCollageBackgroundRef(data, sampleW, sampleH) {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let n = 0;
    const edgeBand = Math.max(2, Math.floor(sampleH * 0.08));
    function sampleEdge(y0, y1, x0, x1) {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * sampleW + x) * 4;
          rSum += data[i];
          gSum += data[i + 1];
          bSum += data[i + 2];
          n++;
        }
      }
    }
    sampleEdge(0, edgeBand, 0, sampleW);
    sampleEdge(sampleH - edgeBand, sampleH, 0, sampleW);
    sampleEdge(0, sampleH, 0, Math.max(3, Math.floor(sampleW * 0.06)));
    sampleEdge(0, sampleH, sampleW - Math.max(3, Math.floor(sampleW * 0.06)), sampleW);
    if (!n) return { r: 250, g: 250, b: 248 };
    return { r: rSum / n, g: gSum / n, b: bSum / n };
  }

  function isCollageContentPixel(data, i, bgRef) {
    if (!nearWhiteAt(data, i)) return true;
    const dr = Math.abs(data[i] - bgRef.r);
    const dg = Math.abs(data[i + 1] - bgRef.g);
    const db = Math.abs(data[i + 2] - bgRef.b);
    return dr + dg + db > 28;
  }

  /** Per-column product density (0–1) on a downsampled canvas. */
  function collageColumnDensity(img, options = {}) {
    const { sampleW, sampleH, data } = collageSampleCanvas(img);
    const bgRef = estimateCollageBackgroundRef(data, sampleW, sampleH);
    const col = new Float32Array(sampleW);
    for (let x = 0; x < sampleW; x++) {
      let content = 0;
      for (let y = 0; y < sampleH; y++) {
        const i = (y * sampleW + x) * 4;
        if (isCollageContentPixel(data, i, bgRef)) content++;
      }
      col[x] = content / sampleH;
    }
    return col;
  }

  function averageColumnRange(col, x0, x1) {
    let sum = 0;
    let n = 0;
    for (let i = x0; i < x1; i++) {
      sum += col[i];
      n++;
    }
    return n ? sum / n : 0;
  }

  /** Two product peaks (left + right) with a lighter center seam — classic front|back collage. */
  function detectTwinPeakSplit(col, options = {}) {
    const minPeak = options.relaxed ? 0.04 : 0.05;
    const centerRatio = options.relaxed ? 0.86 : 0.8;
    const W = col.length;
    const l0 = Math.floor(W * 0.04);
    const l1 = Math.floor(W * 0.47);
    const c0 = Math.floor(W * 0.4);
    const c1 = Math.ceil(W * 0.6);
    const r0 = Math.ceil(W * 0.53);
    const r1 = Math.floor(W * 0.96);
    let leftPeak = 0;
    let rightPeak = 0;
    let centerMin = 1;
    for (let i = l0; i < l1; i++) if (col[i] > leftPeak) leftPeak = col[i];
    for (let i = r0; i < r1; i++) if (col[i] > rightPeak) rightPeak = col[i];
    for (let i = c0; i < c1; i++) if (col[i] < centerMin) centerMin = col[i];
    if (leftPeak < minPeak || rightPeak < minPeak) return false;
    return centerMin <= leftPeak * centerRatio && centerMin <= rightPeak * centerRatio;
  }

  /** Both halves carry product — used when user explicitly chose Collage mode. */
  function detectBalancedHalves(col, minAvg = 0.03) {
    const W = col.length;
    const mid = Math.floor(W / 2);
    const leftAvg = averageColumnRange(col, 0, mid);
    const rightAvg = averageColumnRange(col, mid, W);
    return leftAvg >= minAvg && rightAvg >= minAvg;
  }

  /** Single centered product on square — avoid false split in Collage mode. */
  function isSingleCenteredProduct(col) {
    const W = col.length;
    let maxVal = 0;
    let maxIdx = 0;
    let total = 0;
    let weighted = 0;
    for (let i = 0; i < W; i++) {
      total += col[i];
      weighted += col[i] * i;
      if (col[i] > maxVal) {
        maxVal = col[i];
        maxIdx = i;
      }
    }
    if (maxVal < 0.05) return false;
    const com = total > 0 ? weighted / total : W / 2;
    const centerHeavy = maxIdx >= W * 0.34 && maxIdx <= W * 0.66;
    const comCentered = com >= W * 0.38 && com <= W * 0.62;
    const leftAvg = averageColumnRange(col, 0, Math.floor(W * 0.34));
    const rightAvg = averageColumnRange(col, Math.ceil(W * 0.66), W);
    const centerAvg = averageColumnRange(col, Math.floor(W * 0.34), Math.ceil(W * 0.66));
    const sideAvg = (leftAvg + rightAvg) / 2;
    return (centerHeavy || comCentered) && centerAvg >= sideAvg * 0.92;
  }

  /** Left + right panels both carry product; center seam may be thin or flush cream. */
  function detectSideBySidePanels(col, options = {}) {
    const W = col.length;
    const leftAvg = averageColumnRange(col, Math.floor(W * 0.02), Math.floor(W * 0.48));
    const rightAvg = averageColumnRange(col, Math.ceil(W * 0.52), Math.floor(W * 0.98));
    const centerAvg = averageColumnRange(col, Math.floor(W * 0.44), Math.ceil(W * 0.56));
    const minSide = options.relaxed ? 0.028 : 0.04;
    if (leftAvg < minSide || rightAvg < minSide) return false;
    if (detectTwinPeakSplit(col, options)) return true;
    const sideAvg = (leftAvg + rightAvg) / 2;
    if (centerAvg <= sideAvg * 0.9) return true;
    if (options.relaxed && leftAvg >= 0.03 && rightAvg >= 0.03) return true;
    return false;
  }

  /** Detect left/right product panels with a light center gutter (front+back collages). */
  function hasSplitCollageContent(img, options = {}) {
    const col = collageColumnDensity(img);
    if (detectTwinPeakSplit(col, options)) return true;
    if (detectSideBySidePanels(col, options)) return true;

    const { sampleW, sampleH, data } = collageSampleCanvas(img);
    const bgRef = estimateCollageBackgroundRef(data, sampleW, sampleH);
    const minRatio = options.relaxed ? 0.035 : 0.05;

    function contentRatio(x0, x1) {
      let content = 0;
      let total = 0;
      for (let y = 0; y < sampleH; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * sampleW + x) * 4;
          total++;
          if (isCollageContentPixel(data, i, bgRef)) content++;
        }
      }
      return total ? content / total : 0;
    }

    const leftRatio = contentRatio(Math.floor(sampleW * 0.02), Math.floor(sampleW * 0.48));
    const rightRatio = contentRatio(Math.ceil(sampleW * 0.52), Math.floor(sampleW * 0.98));
    return leftRatio >= minRatio && rightRatio >= minRatio;
  }

  /** Square 1:1 or wide ~2:1 front+back collages — split at center. */
  function isLingerieSplitCollage(img, options = {}) {
    const w = img.width;
    const h = img.height;
    const aspect = w / Math.max(1, h);
    const maxSide = Math.max(w, h);
    const minSide = Math.min(w, h);
    const minMax = options.collageMode ? SPLIT_COLLAGE_COLLAGE_MODE_MIN_MAX : SPLIT_COLLAGE_MIN_MAX_SIDE;
    const minMin = options.collageMode ? SPLIT_COLLAGE_COLLAGE_MODE_MIN_MIN : SPLIT_COLLAGE_MIN_MIN_SIDE;
    if (maxSide < minMax || minSide < minMin) return false;
    if (aspect < SPLIT_COLLAGE_ASPECT_MIN || aspect > SPLIT_COLLAGE_ASPECT_MAX) return false;

    const detectOpts = { relaxed: !!options.collageMode };
    const col = collageColumnDensity(img);

    if (detectTwinPeakSplit(col, detectOpts)) return true;
    if (hasSplitCollageContent(img, detectOpts)) return true;
    if (detectBalancedHalves(col, options.collageMode ? 0.025 : 0.04)) return true;

    if (options.collageMode) {
      if (aspect >= SPLIT_COLLAGE_WIDE_ASPECT && !isSingleCenteredProduct(col)) return true;
      if (detectSideBySidePanels(col, detectOpts) && !isSingleCenteredProduct(col)) return true;
    }
    return false;
  }

  function withLingerieLayout(profile, layout, priority, suffix = "") {
    const tag = suffix ? ` ${suffix}` : "";
    const path =
      profile.path ||
      (layout === "panel_right" ||
      String(layout).startsWith("panel_") ||
      String(layout).startsWith("b_")
        ? "studio_panel"
        : "studio_square");
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
   * Front — multiple KB tiers per canvas. Back — multiple layouts × 54–58 KB band.
   */
  function lingerieProfilesForImage(img, options = {}) {
    const split = isLingerieSplitCollage(img, options);
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
      const backProfiles = LINGERIE_BACK_LAYOUTS.map((layoutSpec) =>
        withLingerieLayout(
          {
            ...base,
            id: `lingerie_${layoutSpec.layout}`,
            tiers: lingerieBackTiers(layoutSpec),
          },
          layoutSpec.layout,
          layoutSpec.priority,
          `· ${layoutSpec.panelTag}`
        )
      );
      return [...frontProfiles, ...backProfiles];
    }
    return [withLingerieLayout(base, "square", 0, "· 1:1 square")];
  }

  /** Framed collage mirrors studio scenarios — same KB/layout, border + stickers from UI. */
  function lingerieFramedProfilesForImage(img, options = {}) {
    return lingerieProfilesForImage(img, options).map((profile) => {
      const back = isLingerieBackLayout(profile.studioLayout, profile.id);
      return {
        ...profile,
        id: `${profile.id}_framed`,
        studio: false,
        collageFramed: true,
        path: "framed_collage",
        modeName: `${profile.modeName} · framed`,
        lingeriePriority: (profile.lingeriePriority ?? 50) + 40,
        framedMaxSide: back ? LINGERIE_BACK_FRAMED_MAX_SIDE : MEESHO_FRAMED_MAX_SIDE,
        tiers: profile.tiers.map((tier) => ({
          ...tier,
          targetKb: back ? tier.framedTargetKb ?? Math.max(48, tier.targetKb - 5) : tier.targetKb,
          label: `${tier.label} · framed`,
        })),
      };
    });
  }

  function prepareLingerieFramedLayoutCanvas(img, layout, frameStyle, framedMaxSide) {
    const studioCanvas = prepareLingerieLayoutCanvas(img, layout);
    return prepareFramedCanvas(
      studioCanvas,
      framedMaxSide ?? MEESHO_FRAMED_MAX_SIDE,
      frameStyle
    );
  }

  function imageToWhiteCanvas(img) {
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

  function prepareFlatlayPortraitCanvas(img, spec) {
    const pw = spec.portraitW ?? FLATLAY_PORTRAIT_W;
    const ph = spec.portraitH ?? FLATLAY_PORTRAIT_H;
    const coverage = spec.coverage ?? 0.88;
    const trimmed = trimContentMargins(imageToWhiteCanvas(img), 0.02);
    const c = document.createElement("canvas");
    c.width = pw;
    c.height = ph;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pw, ph);
    const fitScale = Math.min((pw * coverage) / trimmed.width, (ph * coverage) / trimmed.height);
    const dw = Math.round(trimmed.width * fitScale);
    const dh = Math.round(trimmed.height * fitScale);
    const dx = Math.round((pw - dw) / 2);
    const dy = Math.round((ph - dh) / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, dx, dy, dw, dh);
    return c;
  }

  /** SupplierDen-only trim — tighter margins so tall kaftan fills portrait canvas. */
  function prepareSupplierDenSubjectCanvas(img) {
    return trimContentMargins(imageToWhiteCanvas(img), 0.012);
  }

  /** Fit subject inside photo area with fixed margin ratios (SupplierDen reference: ~15% top, ~5% bottom, ~10% sides). */
  function fitSubjectWithMargins(trimmed, areaW, areaH, margins) {
    const topM = areaH * (margins.top ?? 0.15);
    const bottomM = areaH * (margins.bottom ?? 0.05);
    const sideM = areaW * (margins.side ?? 0.1);
    const availW = Math.max(1, areaW - sideM * 2);
    const availH = Math.max(1, areaH - topM - bottomM);
    const fitScale = Math.min(availW / trimmed.width, availH / trimmed.height);
    const dw = Math.round(trimmed.width * fitScale);
    const dh = Math.round(trimmed.height * fitScale);
    const dx = Math.round(sideM + (availW - dw) / 2);
    const dy = Math.round(topM + (availH - dh) / 2);
    return { dx, dy, dw, dh };
  }

  function isSupplierDenProfileId(profileId) {
    return String(profileId || "").startsWith("supplierden_");
  }

  function supplierDenExactDims(spec, frameStyle) {
    const outerW = spec.outerW ?? SUPPLIERDEN_EXACT_OUTER_W;
    const outerH = spec.outerH ?? SUPPLIERDEN_EXACT_OUTER_H;
    const baseBorder = spec.borderPx ?? SUPPLIERDEN_EXACT_BORDER_PX;
    const widthScale = resolveBorderWidthScale(frameStyle);
    const border = Math.max(4, Math.round(baseBorder * widthScale));
    return { outerW, outerH, border, photoW: outerW - border * 2, photoH: outerH - border * 2 };
  }

  function supplierDenMargins(spec) {
    return {
      top: spec.topMarginRatio ?? 0.15,
      bottom: spec.bottomMarginRatio ?? 0.05,
      side: spec.sideMarginRatio ?? 0.1,
    };
  }

  function drawSupplierDenSubject(ctx, trimmed, spec, offsetX, offsetY, areaW, areaH) {
    const { dx, dy, dw, dh } = fitSubjectWithMargins(trimmed, areaW, areaH, supplierDenMargins(spec));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, offsetX + dx, offsetY + dy, dw, dh);
  }

  /** Tall dress ₹50 — full outer white canvas, no border (reframe: no frame). */
  function prepareSupplierDenExactStudioCanvas(img, spec) {
    const { outerW, outerH } = supplierDenExactDims(spec);
    const trimmed = prepareSupplierDenSubjectCanvas(img);
    const c = document.createElement("canvas");
    c.width = outerW;
    c.height = outerH;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outerW, outerH);
    drawSupplierDenSubject(ctx, trimmed, spec, 0, 0, outerW, outerH);
    return c;
  }

  /**
   * Tall dress ₹50 — fixed outer canvas (703×1024), thin border, centered subject + stickers.
   */
  function prepareSupplierDenExactFramedCanvas(img, spec, frameStyle) {
    const style = { ...defaultFrameStyle(), ...(frameStyle || {}) };
    const { outerW, outerH, border, photoW, photoH } = supplierDenExactDims(spec, style);
    const trimmed = prepareSupplierDenSubjectCanvas(img);
    const c = document.createElement("canvas");
    c.width = outerW;
    c.height = outerH;
    const ctx = c.getContext("2d");
    ctx.fillStyle = normalizeBorderColor(style.borderColor);
    ctx.fillRect(0, 0, outerW, outerH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(border, border, photoW, photoH);
    drawSupplierDenSubject(ctx, trimmed, spec, border, border, photoW, photoH);
    drawFramedOverlays(ctx, border, photoW, photoH, style);
    return c;
  }

  /** SupplierDen layout prep — isolated from flatlay/full-length portrait centering. */
  function prepareSupplierDenLayoutCanvas(img, layoutSpec, frameStyle) {
    if (layoutSpec.type === "exact_framed") {
      return prepareSupplierDenExactFramedCanvas(img, layoutSpec, frameStyle);
    }
    return prepareFlatlayLayoutCanvas(img, layoutSpec, frameStyle);
  }

  function prepareFlatlayNativeStudio(img) {
    return trimContentMargins(imageToWhiteCanvas(img), 0.02);
  }

  function prepareNativeCappedStudio(img, maxSide = 1024) {
    const trimmed = prepareFlatlayNativeStudio(img);
    const max = Math.max(trimmed.width, trimmed.height);
    if (max <= maxSide) return trimmed;
    const scale = maxSide / max;
    const w = Math.round(trimmed.width * scale);
    const h = Math.round(trimmed.height * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, 0, 0, w, h);
    return c;
  }

  function flatlayFramedStyle(layoutSpec, frameStyle) {
    if (layoutSpec.noStickers) {
      return mergeFrameStyle(frameStyle, { stickerTemplate: "none" });
    }
    return frameStyle;
  }

  function prepareFlatlayLayoutCanvas(img, layoutSpec, frameStyle) {
    const type = layoutSpec.type;
    if (type === "portrait_studio") {
      return prepareFlatlayPortraitCanvas(img, layoutSpec);
    }
    if (type === "square_studio") {
      const trimmed = trimContentMargins(imageToWhiteCanvas(img), 0.02);
      return prepareLingerieSquareCanvas(trimmed, {
        side: layoutSpec.side,
        coverage: layoutSpec.coverage,
      });
    }
    if (type === "portrait_framed") {
      const studio = prepareFlatlayPortraitCanvas(img, layoutSpec);
      return prepareFramedCanvas(
        studio,
        layoutSpec.framedMaxSide ?? 1024,
        flatlayFramedStyle(layoutSpec, frameStyle)
      );
    }
    if (type === "square_framed") {
      const trimmed = trimContentMargins(imageToWhiteCanvas(img), 0.02);
      const sq = prepareLingerieSquareCanvas(trimmed, {
        side: layoutSpec.side,
        coverage: layoutSpec.coverage,
      });
      return prepareFramedCanvas(
        sq,
        layoutSpec.framedMaxSide ?? 1024,
        flatlayFramedStyle(layoutSpec, frameStyle)
      );
    }
    if (type === "native_studio") {
      return prepareFlatlayNativeStudio(img);
    }
    if (type === "native_capped_studio") {
      return prepareNativeCappedStudio(img, layoutSpec.capMaxSide ?? 1024);
    }
    if (type === "native_capped_framed") {
      const studio = prepareNativeCappedStudio(img, layoutSpec.capMaxSide ?? 1024);
      return prepareFramedCanvas(
        studio,
        layoutSpec.framedMaxSide ?? 1024,
        flatlayFramedStyle(layoutSpec, frameStyle)
      );
    }
    if (type === "native_framed") {
      const studio = prepareFlatlayNativeStudio(img);
      return prepareFramedCanvas(
        studio,
        layoutSpec.framedMaxSide ?? 1024,
        flatlayFramedStyle(layoutSpec, frameStyle)
      );
    }
    return prepareCanvas(img, true);
  }

  function apparelProfileKey(profile) {
    if (profile.fullLength) return "full_length";
    if (profile.modelPhoto) return "model";
    return "flatlay";
  }

  function apparelPathForLayout(profile, layoutSpec, isFramed) {
    const key = apparelProfileKey(profile);
    if (isFramed) {
      if (key === "full_length") return "full_length_framed";
      if (key === "model") return "model_framed";
      return "flatlay_framed";
    }
    if (layoutSpec.type === "square_studio") return "flatlay_square";
    if (key === "full_length") return "full_length_portrait";
    if (key === "model") return "model_portrait";
    return "flatlay_portrait";
  }

  function withFlatlayLayout(profile, layoutSpec) {
    const isFramed = String(layoutSpec.type || "").includes("framed");
    const key = apparelProfileKey(profile);
    const labels = { full_length: "Full-length", model: "Model", flatlay: "Flat-lay" };
    return {
      ...profile,
      id: `${key}_${layoutSpec.layout}`,
      modeName: `${labels[key]} · ${layoutSpec.panelTag || layoutSpec.layout}`,
      studio: !isFramed,
      collageFramed: false,
      path: apparelPathForLayout(profile, layoutSpec, isFramed),
      studioLayout: layoutSpec.layout,
      flatlaySpec: layoutSpec,
      flatlayPriority: layoutSpec.priority ?? 50,
      framedMaxSide: layoutSpec.framedMaxSide,
      tiers: layoutSpec.tiers,
    };
  }

  function flatlayProfilesForImage() {
    const base = profileFlatlayApparel();
    return FLATLAY_LAYOUTS.map((layoutSpec) => withFlatlayLayout(base, layoutSpec)).sort(
      (a, b) => (a.flatlayPriority ?? 99) - (b.flatlayPriority ?? 99)
    );
  }

  function modelProfilesForImage() {
    const base = profileModelPhoto();
    return MODEL_PHOTO_LAYOUTS.map((layoutSpec) => withFlatlayLayout(base, layoutSpec)).sort(
      (a, b) => (a.flatlayPriority ?? 99) - (b.flatlayPriority ?? 99)
    );
  }

  function fullLengthProfilesForImage() {
    const base = profileFullLength();
    return FULL_LENGTH_LAYOUTS.map((layoutSpec) => withFlatlayLayout(base, layoutSpec)).sort(
      (a, b) => (a.flatlayPriority ?? 99) - (b.flatlayPriority ?? 99)
    );
  }

  async function optimizeApparelLayoutsAll(img, profiles, maxVariants, frameStyle, onProgress, labelPrefix) {
    const totalSteps = profiles.reduce((sum, p) => sum + p.tiers.length, 0);
    const allVariants = [];
    let done = 0;
    for (const profile of profiles) {
      const canvas = prepareFlatlayLayoutCanvas(img, profile.flatlaySpec, frameStyle);
      const whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
      for (const tier of profile.tiers) {
        if (onProgress) {
          onProgress(
            10 + (done / totalSteps) * 85,
            `${labelPrefix} · ${profile.modeName} · ${tier.label}`
          );
        }
        allVariants.push(
          await buildVariantForTier(canvas, whiteRatio, profile, tier, {
            showMode: true,
            reframeMeta: buildReframeMeta(profile, tier, {
              frameStyle: profile.studio ? null : flatlayFramedStyle(profile.flatlaySpec, frameStyle),
              studioLayout: profile.studioLayout,
              whiteRatio,
            }),
          })
        );
        done += 1;
        await yieldToMain();
      }
    }
    return finalizeAutoVariants(allVariants, {
      maxVariants,
      minVariants: 1,
    });
  }

  async function optimizeFlatlayApparelAll(img, frameStyle, onProgress) {
    return optimizeApparelLayoutsAll(
      img,
      flatlayProfilesForImage(),
      FLATLAY_MAX_VARIANTS,
      frameStyle,
      onProgress,
      "Flat-lay"
    );
  }

  async function optimizeModelPhotoAll(img, frameStyle, onProgress) {
    return optimizeApparelLayoutsAll(
      img,
      modelProfilesForImage(),
      MODEL_PHOTO_MAX_VARIANTS,
      frameStyle,
      onProgress,
      "Model"
    );
  }

  async function optimizeFullLengthAll(img, frameStyle, onProgress) {
    return optimizeApparelLayoutsAll(
      img,
      fullLengthProfilesForImage(),
      FULL_LENGTH_MAX_VARIANTS,
      frameStyle,
      onProgress,
      "Full-length"
    );
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
    const backSpec = LINGERIE_BACK_LAYOUTS.find((s) => s.layout === layout);
    if (backSpec) return { side: backSpec.side, coverage: backSpec.coverage };
    const frontSpec = LINGERIE_FRONT_LAYOUTS.find((s) => s.layout === layout);
    if (frontSpec) return { side: frontSpec.side, coverage: frontSpec.coverage };
    return { side: STUDIO_SQUARE_SIDE, coverage: LINGERIE_BACK_COVERAGE };
  }

  function prepareLingerieLayoutCanvas(img, layout) {
    if (layout === "panel_right" || String(layout).startsWith("b_")) {
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
        ? prepareLingerieFramedLayoutCanvas(
            img,
            profile.studioLayout,
            frameStyle,
            profile.framedMaxSide
          )
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
          await buildVariantForTier(canvas, whiteRatio, profile, tier, {
            showMode: true,
            reframeMeta: buildReframeMeta(profile, tier, {
              frameStyle: profile.collageFramed ? frameStyle : null,
              studioLayout: profile.studioLayout,
              whiteRatio,
            }),
          })
        );
        done += 1;
        await yieldToMain();
      }
      releaseCanvas(canvas);
    }
    return done;
  }

  /** Collage — studio scenarios + framed copies (border + sticker from UI). Auto collage unchanged. */
  async function optimizeLingerieAll(img, frameStyle, onProgress) {
    const collageOpts = { collageMode: true };
    const studioProfiles = lingerieProfilesForImage(img, collageOpts);
    const framedProfiles = lingerieFramedProfilesForImage(img, collageOpts);
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
        (a.lingeriePriority ?? a.flatlayPriority ?? a.autoPriority ?? 99) -
          (b.lingeriePriority ?? b.flatlayPriority ?? b.autoPriority ?? 99) ||
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

  /** SupplierDen — prefer exact 703×1024, then any max side ≤1024. */
  function finalizeSupplierDenVariants(variants, options = {}) {
    const exact703 = variants.filter((v) => v.width === 703 && v.height === 1024);
    const portraitBand = variants.filter((v) => Math.max(v.width, v.height) <= 1024);
    const pool = exact703.length > 0 ? exact703 : portraitBand.length > 0 ? portraitBand : variants;
    return finalizeAutoVariants(pool, options);
  }

  function pathOf(url) {
    try {
      return new URL(url, location.origin).pathname;
    } catch {
      return String(url).split("?")[0];
    }
  }

  function isOwnRoute(path) {
    if (useServerProcessing && (isProcessingRoute(path) || path === "/api/health")) return false;
    return (
      path === "/api/health" ||
      path === "/auth/me" ||
      path === "/auth/logout" ||
      path === "/api/meesho/fetchCategoryTreeOrder" ||
      path === "/api/meesho/fetchAllRequestId" ||
      path === "/api/meesho/getLowestShippingCharge" ||
      /^\/api\/meesho\/request(?:-status)?\/[^/]+$/.test(path) ||
      /^\/api\/meesho\/cancel-request\/[^/]+$/.test(path)
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

  function isFlatlayTagName(tagName) {
    const tag = String(tagName || "").toLowerCase();
    return (
      tag.includes("flat-lay") ||
      tag.includes("flatlay") ||
      tag.includes("apparel lowest") ||
      tag.includes("crop top flat")
    );
  }

  function isModelPhotoTagName(tagName) {
    const tag = String(tagName || "").toLowerCase();
    return (
      tag.includes("model photo") ||
      tag.includes("model lowest") ||
      tag.includes("on-person") ||
      tag.includes("model apparel")
    );
  }

  function isFullLengthTagName(tagName) {
    if (isSupplierDenTagName(tagName)) return false;
    const tag = String(tagName || "").toLowerCase();
    return (
      tag.includes("full-length") ||
      tag.includes("full length") ||
      tag.includes("enlarged") ||
      tag.includes("full-length lowest") ||
      tag.includes("kaftan") ||
      tag.includes("dress full") ||
      tag.includes("saree full")
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

  function staleProcessingMs(tagName) {
    if (isAutoTagName(tagName)) return AUTO_PROCESS_TIMEOUT_MS + STALE_BUFFER_MS;
    if (isLingerieTagName(tagName)) return LINGERIE_PROCESS_TIMEOUT_MS + STALE_BUFFER_MS;
    if (isFlatlayTagName(tagName)) return FLATLAY_PROCESS_TIMEOUT_MS + STALE_BUFFER_MS;
    if (isModelPhotoTagName(tagName)) return MODEL_PHOTO_PROCESS_TIMEOUT_MS + STALE_BUFFER_MS;
    if (isFullLengthTagName(tagName)) return FULL_LENGTH_PROCESS_TIMEOUT_MS + STALE_BUFFER_MS;
    if (isSupplierDenTagName(tagName)) return SUPPLIERDEN_PROCESS_TIMEOUT_MS + STALE_BUFFER_MS;
    return PROCESS_TIMEOUT_MS + STALE_BUFFER_MS;
  }

  function yieldToMain(forceGcPause = false) {
    yieldCounter += 1;
    const delay = forceGcPause || yieldCounter % 5 === 0 ? 16 : 0;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  function releaseCanvas(canvas) {
    if (!canvas) return;
    try {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    } catch {
      /* ignore */
    }
  }

  function releaseVariantBlob(variant) {
    if (!variant) return;
    variant.blob = null;
  }

  function releaseVariantMemory(variants) {
    if (!Array.isArray(variants)) return;
    for (const variant of variants) releaseVariantBlob(variant);
  }

  const JOB_IMAGE_DB = "meesho-job-images";
  const JOB_IMAGE_STORE = "sources";

  function openJobImageDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(JOB_IMAGE_DB, 1);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(JOB_IMAGE_STORE);
      };
      req.onsuccess = () => resolve(req.result);
    });
  }

  async function saveJobImage(id, file) {
    try {
      const db = await openJobImageDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(JOB_IMAGE_STORE, "readwrite");
        tx.objectStore(JOB_IMAGE_STORE).put(file, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn("[own-api] job image save failed:", e);
    }
  }

  async function loadJobImage(id) {
    try {
      const db = await openJobImageDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(JOB_IMAGE_STORE, "readonly");
        const get = tx.objectStore(JOB_IMAGE_STORE).get(id);
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => reject(get.error);
      });
    } catch {
      return null;
    }
  }

  async function deleteJobImage(id) {
    try {
      const db = await openJobImageDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(JOB_IMAGE_STORE, "readwrite");
        tx.objectStore(JOB_IMAGE_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* ignore */
    }
  }

  async function resumeJobIfNeeded(id) {
    const req = loadRequest(id);
    if (!req || req.status !== "processing" || PROCESSING.has(id)) return;
    const image = await loadJobImage(id);
    if (!image) return;
    void processImage(id, image, req.tagName, req.frameStyle || parseFrameStyle({}));
  }

  async function resumeInterruptedJobs() {
    for (const id of readIndex()) {
      await resumeJobIfNeeded(id);
    }
  }

  function persistRequest(id, req) {
    const payload = {
      createdAt: req.createdAt,
      tagName: req.tagName,
      frameStyle: req.frameStyle || null,
      status: req.status,
      progress: typeof req.progress === "number" ? req.progress : 0,
      progressLabel: req.progressLabel || "",
      results: (req.results || []).map(stripReframeMeta),
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

  function cancelRequest(id) {
    const req = loadRequest(id);
    if (!req) return null;
    if (req.status === "completed") return req;
    req.status = "cancelled";
    req.error = "Cancelled";
    req.progressLabel = "Cancelled";
    STORE.requests.set(id, req);
    persistRequest(id, req);
    void deleteJobImage(id);
    return req;
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
    if (isSupplierDenTagName(tag)) {
      return profileSupplierDenMatch();
    }
    if (
      tag.includes("flat-lay") ||
      tag.includes("flatlay") ||
      tag.includes("apparel lowest") ||
      tag.includes("crop top flat")
    ) {
      return { id: "flatlay_all", flatlayApparel: true, modeName: "Flat-Lay Apparel Lowest ₹" };
    }
    if (
      tag.includes("model photo") ||
      tag.includes("model lowest") ||
      tag.includes("on-person") ||
      tag.includes("model apparel")
    ) {
      return { id: "model_all", modelPhoto: true, modeName: "Model Photo Lowest ₹" };
    }
    if (
      tag.includes("full-length") ||
      tag.includes("full length") ||
      tag.includes("enlarged") ||
      tag.includes("full-length lowest") ||
      tag.includes("kaftan") ||
      tag.includes("dress full") ||
      tag.includes("saree full")
    ) {
      return { id: "full_length_all", fullLength: true, modeName: "Full-Length Lowest ₹" };
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

    return isStudioWhiteBackground(img) ? profileStudio() : profileFramed();
  }

  function framedBorderPx(w, h, framedMaxSide = MEESHO_FRAMED_MAX_SIDE, widthScale = 1) {
    const scale = Math.max(0.35, Math.min(1.75, Number(widthScale) || 1));
    let border = Math.max(
      Math.round(FRAME_MIN_BORDER * scale),
      Math.round(Math.min(w, h) * FRAME_BORDER_RATIO * scale)
    );
    if (scale < 1) border = Math.max(10, border);
    else border = Math.max(FRAME_MIN_BORDER, border);
    const maxSide = Math.max(w, h);
    if (maxSide + border * 2 > framedMaxSide) {
      const capped = Math.floor((framedMaxSide - maxSide) / 2);
      const minCap = scale < 1 ? 10 : 28;
      if (capped >= minCap) border = capped;
    }
    return border;
  }

  function framedOuterMaxSide(w, h, framedMaxSide = MEESHO_FRAMED_MAX_SIDE, widthScale = 1) {
    return Math.max(w, h) + framedBorderPx(w, h, framedMaxSide, widthScale) * 2;
  }

  /** Proportional downscale only — keeps aspect ratio, no crop; Meesho tiers on framed max side (~1280). */
  function fitFramedPhotoDims(w, h, framedMaxSide = MEESHO_FRAMED_MAX_SIDE, widthScale = 1) {
    let nw = w;
    let nh = h;
    const max0 = Math.max(nw, nh);
    if (max0 > MAX_SIDE) {
      const scale = MAX_SIDE / max0;
      nw = Math.round(nw * scale);
      nh = Math.round(nh * scale);
    }
    for (let i = 0; i < 12 && framedOuterMaxSide(nw, nh, framedMaxSide, widthScale) > framedMaxSide; i++) {
      const framed = framedOuterMaxSide(nw, nh, framedMaxSide, widthScale);
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

  function renderSpecialOfferBadge(scale, texts = {}) {
    const line1 = String(texts.line1 || "SPECIAL").slice(0, 14);
    const line2 = String(texts.line2 || "OFFER").slice(0, 14);
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
    ctx.strokeText(line1, w / 2, h * 0.34);
    ctx.fillText(line1, w / 2, h * 0.34);
    ctx.strokeText(line2, w / 2, h * 0.72);
    ctx.fillText(line2, w / 2, h * 0.72);
    return { canvas: c, width: bw, height: bh };
  }

  function renderHotSaleBurst(scale, texts = {}) {
    const line1 = String(texts.line1 || "HOT").slice(0, 10);
    const line2 = String(texts.line2 || "SALE").slice(0, 10);
    const line3 = String(texts.line3 || texts.line2 || "BIG SALE").slice(0, 12);
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
    drawStickerText(ctx, line1, 0, -14 * scale, 15, scale, { strokeWidth: 1.5 });
    drawStickerText(ctx, line2, 0, 4 * scale, 13, scale, { strokeWidth: 1.45 });
    drawStickerText(ctx, line3, 0, 22 * scale, 12, scale, { strokeWidth: 1.6 });
    return { canvas: c, width: size, height: size };
  }

  function renderLimitedTimeBadge(scale, texts = {}) {
    const line1 = String(texts.line1 || "LIMITED").slice(0, 12);
    const line2 = String(texts.line2 || "TIME").slice(0, 12);
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
    drawStickerText(ctx, line1, w / 2, h * 0.36, 11, scale, { fill: "#FFD600", stroke: "#311B92" });
    drawStickerText(ctx, line2, w / 2, h * 0.72, 11, scale, { fill: "#FFFFFF", stroke: "#311B92" });
    return { canvas: c, width: bw, height: bh };
  }

  function renderBestPriceRibbon(scale, texts = {}) {
    const line1 = String(texts.line1 || "BEST PRICE").slice(0, 16);
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
    drawStickerText(ctx, line1, size * 0.47, 17 * scale, 13, scale, { fill: "#FFD600", stroke: "#7F0000", strokeWidth: 1.2 });
    return { canvas: c, width: size, height: size };
  }

  function renderMegaSaleBadge(scale, texts = {}) {
    const line1 = String(texts.line1 || "MEGA").slice(0, 10);
    const line2 = String(texts.line2 || "SALE").slice(0, 10);
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
    drawStickerText(ctx, line1, w / 2, h * 0.35, 14, scale, { fill: "#FFEB3B", stroke: "#B71C1C" });
    drawStickerText(ctx, line2, w / 2, h * 0.72, 14, scale, { fill: "#FFFFFF", stroke: "#B71C1C" });
    return { canvas: c, width: bw, height: bh };
  }

  function renderFlashDealBurst(scale, texts = {}) {
    const line1 = String(texts.line1 || "FLASH").slice(0, 10);
    const line2 = String(texts.line2 || "DEAL").slice(0, 10);
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
    drawStickerText(ctx, line1, 0, -10 * scale, 12, scale, { strokeWidth: 1.4 });
    drawStickerText(ctx, line2, 0, 8 * scale, 12, scale, { strokeWidth: 1.4 });
    return { canvas: c, width: size, height: size };
  }

  function renderSuperOfferBadge(scale, texts = {}) {
    const line1 = String(texts.line1 || "SUPER").slice(0, 10);
    const line2 = String(texts.line2 || "OFFER").slice(0, 10);
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
    drawStickerText(ctx, line1, w / 2, h * 0.34, 12, scale, { fill: "#FFD600", stroke: "#004D40" });
    drawStickerText(ctx, line2, w / 2, h * 0.72, 12, scale, { fill: "#FFFFFF", stroke: "#004D40" });
    return { canvas: c, width: w + pad * 2, height: h + pad * 2 };
  }

  function renderFlatOffBadge(scale, texts = {}) {
    const line1 = String(texts.line1 || "50%").slice(0, 8);
    const line2 = String(texts.line2 || "OFF").slice(0, 8);
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
    drawStickerText(ctx, line1, d / 2, d / 2 - 6 * scale, 16, scale, { fill: "#FFFFFF", stroke: "#E65100", strokeWidth: 1.5 });
    drawStickerText(ctx, line2, d / 2, d / 2 + 12 * scale, 11, scale, { fill: "#FFEB3B", stroke: "#E65100", strokeWidth: 1.2 });
    return { canvas: c, width: d, height: d };
  }

  function renderFreeDeliverySticker(scale, texts = {}) {
    const line1 = String(texts.line1 || "FREE").slice(0, 12);
    const line2 = String(texts.line2 || "DELIVERY").slice(0, 12);
    const truckW = 54 * scale;
    const truckH = 34 * scale;
    const textW = 92 * scale;
    const textH = 52 * scale;
    const gap = 6 * scale;
    const pad = 10 * scale;
    const bw = truckW + gap + textW + pad * 2;
    const bh = Math.max(truckH, textH) + pad * 2;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(bw * ss);
    c.height = Math.ceil(bh * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    ctx.translate(pad, pad);

    const truckY = (bh - pad * 2 - truckH) / 2;
    ctx.fillStyle = "#D32F2F";
    roundRectPath(ctx, 0, truckY + truckH * 0.42, truckW * 0.72, truckH * 0.34, 3 * scale);
    ctx.fill();
    roundRectPath(ctx, truckW * 0.08, truckY + truckH * 0.18, truckW * 0.52, truckH * 0.42, 4 * scale);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(truckW * 0.2, truckY + truckH * 0.82, 5 * scale, 0, Math.PI * 2);
    ctx.arc(truckW * 0.58, truckY + truckH * 0.82, 5 * scale, 0, Math.PI * 2);
    ctx.fill();

    const boxX = truckW + gap;
    const boxY = (bh - pad * 2 - textH) / 2;
    roundRectPath(ctx, boxX, boxY, textW, textH, 8 * scale);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.2 * scale;
    ctx.stroke();
    ctx.font = `900 ${18 * scale}px Arial,Helvetica,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#111827";
    ctx.fillText(line1, boxX + textW / 2, boxY + textH * 0.38);
    ctx.font = `800 ${11 * scale}px Arial,Helvetica,sans-serif`;
    ctx.fillText(line2, boxX + textW / 2, boxY + textH * 0.72);

    return { canvas: c, width: bw, height: bh };
  }

  function renderBestChoiceOfferBadge(scale, texts = {}) {
    const line1 = String(texts.line1 || "BEST CHOICE").slice(0, 14);
    const line2 = String(texts.line2 || "OFFER").slice(0, 12);
    const d = 96 * scale;
    const pad = 10 * scale;
    const size = d + pad * 2;
    const ss = OVERLAY_SUPERSAMPLE;
    const c = document.createElement("canvas");
    c.width = Math.ceil(size * ss);
    c.height = Math.ceil(size * ss);
    const ctx = c.getContext("2d");
    ctx.scale(ss, ss);
    const center = size / 2;

    ctx.beginPath();
    ctx.arc(center, center, d / 2, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(center, center, d * 0.1, center, center, d / 2);
    grad.addColorStop(0, "#FF7043");
    grad.addColorStop(0.55, "#7B1FA2");
    grad.addColorStop(1, "#4A148C");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#FFD600";
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();

    ctx.save();
    ctx.translate(center, center - d * 0.18);
    ctx.rotate(-0.08);
    roundRectPath(ctx, -d * 0.42, -d * 0.12, d * 0.84, d * 0.24, 5 * scale);
    ctx.fillStyle = "#2E7D32";
    ctx.fill();
    ctx.strokeStyle = "#A5D6A7";
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();
    drawStickerText(ctx, line1, 0, 0, 9.5, scale, { fill: "#FFFFFF", stroke: "#1B5E20", strokeWidth: 1.1 });
    ctx.restore();

    drawStickerText(ctx, line2, center, center + d * 0.16, 12, scale, { fill: "#FFD600", stroke: "#4A148C", strokeWidth: 1.3 });
    return { canvas: c, width: size, height: size };
  }

  function drawSupplierDenOneStickerOverlay(ctx, border, photoW, photoH) {
    const scale = Math.max(0.78, Math.min(1.35, Math.min(photoW, photoH) / 900));
    const delivery = renderFreeDeliverySticker(scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      delivery.canvas,
      border + photoW * 0.04,
      border + photoH * 0.42 - delivery.height / 2,
      delivery.width,
      delivery.height
    );
  }

  function drawSupplierDenMatchOverlays(ctx, border, photoW, photoH) {
    const scale = Math.max(0.78, Math.min(1.35, Math.min(photoW, photoH) / 900));
    const delivery = renderFreeDeliverySticker(scale);
    const badge = renderBestChoiceOfferBadge(scale * 0.95);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      delivery.canvas,
      border + photoW * 0.04,
      border + photoH * 0.42 - delivery.height / 2,
      delivery.width,
      delivery.height
    );
    ctx.drawImage(
      badge.canvas,
      border + photoW * 0.5 - badge.width / 2,
      border + photoH * 0.38 - badge.height / 2,
      badge.width,
      badge.height
    );
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

  function drawFramedOverlays(ctx, border, photoW, photoH, frameStyleOrTemplate) {
    const frameStyle =
      typeof frameStyleOrTemplate === "string"
        ? { stickerTemplate: frameStyleOrTemplate }
        : { ...defaultFrameStyle(), ...(frameStyleOrTemplate || {}) };
    const template = normalizeStickerTemplate(frameStyle.stickerTemplate);
    if (template === "none") return;
    if (frameStyle.stickerLayout) {
      drawFramedOverlaysWithLayout(ctx, border, photoW, photoH, template, frameStyle.stickerLayout);
      return;
    }

    const scale = Math.max(0.78, Math.min(1.35, Math.min(photoW, photoH) / 900));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (template === "classic_promo") {
      drawClassicPromoOverlays(ctx, border, photoW, photoH);
      return;
    }

    if (template === "supplierden_match") {
      drawSupplierDenMatchOverlays(ctx, border, photoW, photoH);
      return;
    }

    if (template === "supplierden_one") {
      drawSupplierDenOneStickerOverlay(ctx, border, photoW, photoH);
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

  const STICKER_SLOT_DEFS = {
    classic_promo: {
      dual: true,
      primary: { type: "special_offer", x: 0.71, y: 0.09, label: "Special offer badge" },
      secondary: { type: "hot_sale", x: 0.16, y: 0.72, label: "Hot sale burst" },
    },
    supplierden_match: {
      dual: true,
      primary: { type: "free_delivery", x: 0.12, y: 0.42, label: "Free delivery" },
      secondary: { type: "best_choice", x: 0.5, y: 0.38, label: "Best choice offer" },
    },
    supplierden_one: {
      dual: false,
      singleOnly: true,
      primary: { type: "free_delivery", x: 0.12, y: 0.42, label: "Free delivery" },
      secondary: null,
    },
    limited_time: {
      dual: true,
      primary: { type: "limited_time", x: 0.64, y: 0.09, label: "Limited time badge" },
      secondary: { type: "flash_deal", x: 0.12, y: 0.7, label: "Flash deal burst" },
    },
    best_price: {
      dual: true,
      primary: { type: "best_price", x: 0.08, y: 0.05, label: "Best price ribbon" },
      secondary: { type: "hot_sale", x: 0.78, y: 0.68, label: "Hot sale burst" },
    },
    flash_deal: {
      dual: true,
      primary: { type: "flash_deal", x: 0.14, y: 0.68, label: "Flash deal burst" },
      secondary: { type: "special_offer", x: 0.71, y: 0.09, label: "Special offer badge" },
    },
    super_offer: {
      dual: true,
      primary: { type: "super_offer", x: 0.71, y: 0.09, label: "Super offer badge" },
      secondary: { type: "flat_off", x: 0.1, y: 0.72, label: "50% off badge" },
    },
    mega_sale: {
      dual: false,
      primary: { type: "mega_sale", x: 0.68, y: 0.08, label: "Mega sale badge" },
      secondary: null,
    },
  };

  const STICKER_ASSET_TYPES = [
    { id: "free_delivery", name: "Free delivery" },
    { id: "best_choice", name: "Best choice offer" },
    { id: "special_offer", name: "Special offer" },
    { id: "hot_sale", name: "Hot sale burst" },
    { id: "limited_time", name: "Limited time" },
    { id: "flash_deal", name: "Flash deal" },
    { id: "best_price", name: "Best price ribbon" },
    { id: "super_offer", name: "Super offer" },
    { id: "flat_off", name: "50% off badge" },
    { id: "mega_sale", name: "Mega sale" },
  ];
  const STICKER_ASSET_TYPE_IDS = new Set(STICKER_ASSET_TYPES.map((t) => t.id));
  const REFRAME_MAX_STICKERS = 5;

  function newStickerSlotId() {
    return "st_" + Math.random().toString(16).slice(2, 10);
  }

  function defaultStickerSlotFromDef(slotDef) {
    return {
      id: newStickerSlotId(),
      type: slotDef.type,
      x: slotDef.x,
      y: slotDef.y,
      text1: "",
      text2: "",
      imageUrl: "",
      scale: 1,
    };
  }

  function defaultStickersForTemplate(templateId) {
    const template = normalizeStickerTemplate(templateId);
    const defs = STICKER_SLOT_DEFS[template] || STICKER_SLOT_DEFS.classic_promo;
    const stickers = [defaultStickerSlotFromDef(defs.primary)];
    if (defs.singleOnly) return stickers;
    if (defs.secondary) {
      stickers.push(defaultStickerSlotFromDef(defs.secondary));
    } else {
      stickers.push(
        defaultStickerSlotFromDef({
          type: "special_offer",
          x: 0.2,
          y: 0.72,
        })
      );
    }
    return stickers;
  }

  function defaultStickerLayoutForTemplate(templateId) {
    return {
      version: 2,
      stickers: defaultStickersForTemplate(templateId),
    };
  }

  function normalizeStickerSlot(slot, fallback) {
    const base = fallback || { type: "special_offer", x: 0.5, y: 0.5 };
    const s = slot || {};
    const type = STICKER_ASSET_TYPE_IDS.has(s.type) ? s.type : base.type;
    return {
      id: String(s.id || newStickerSlotId()),
      type,
      x: clamp01(typeof s.x === "number" ? s.x : base.x),
      y: clamp01(typeof s.y === "number" ? s.y : base.y),
      text1: String(s.text1 || "").slice(0, 16),
      text2: String(s.text2 || "").slice(0, 16),
      imageUrl: String(s.imageUrl || ""),
      scale: Math.min(1.6, Math.max(0.45, Number(s.scale) || 1)),
      _image: s._image || null,
    };
  }

  function migrateLegacyStickerLayout(input, templateId) {
    const defaults = defaultStickerLayoutForTemplate(templateId);
    const src = input || {};
    if (Array.isArray(src.stickers)) {
      if (!src.stickers.length) {
        return { version: 2, stickers: [] };
      }
      return {
        version: 2,
        stickers: src.stickers.slice(0, REFRAME_MAX_STICKERS).map((slot, i) =>
          normalizeStickerSlot(slot, defaults.stickers[i] || defaults.stickers[0])
        ),
      };
    }
    const defs = STICKER_SLOT_DEFS[normalizeStickerTemplate(templateId)] || STICKER_SLOT_DEFS.classic_promo;
    const visibility = src.visibility || "both";
    const stickers = [];
    if ((visibility === "both" || visibility === "primary") && defs.primary) {
      stickers.push(normalizeStickerSlot({ ...src.primary, type: defs.primary.type }, defs.primary));
    }
    if ((visibility === "both" || visibility === "secondary") && defs.secondary) {
      stickers.push(normalizeStickerSlot({ ...src.secondary, type: defs.secondary.type }, defs.secondary));
    }
    if (!stickers.length) return defaults;
    return { version: 2, stickers };
  }

  function normalizeStickerLayout(input, templateId) {
    return migrateLegacyStickerLayout(input, templateId);
  }

  function cloneStickerLayout(layout, templateId) {
    const normalized = normalizeStickerLayout(layout, templateId);
    return {
      version: 2,
      stickers: normalized.stickers.map((slot) => ({
        id: slot.id,
        type: slot.type,
        x: slot.x,
        y: slot.y,
        text1: slot.text1,
        text2: slot.text2,
        imageUrl: slot.imageUrl,
        scale: slot.scale,
      })),
    };
  }

  function newStickerSlot(type, position) {
    const pos = position || { x: 0.5, y: 0.5 };
    return normalizeStickerSlot(
      {
        type: type || "special_offer",
        x: pos.x,
        y: pos.y,
      },
      { type: type || "special_offer", x: pos.x, y: pos.y }
    );
  }

  function clamp01(n) {
    return Math.min(1, Math.max(0, n));
  }

  function templateHasDualStickers(templateId) {
    const template = normalizeStickerTemplate(templateId);
    const defs = STICKER_SLOT_DEFS[template];
    return !!(defs && defs.dual && defs.secondary);
  }

  function getTemplateStickerSlotInfo(templateId) {
    const template = normalizeStickerTemplate(templateId);
    const defs = STICKER_SLOT_DEFS[template] || STICKER_SLOT_DEFS.classic_promo;
    return {
      dual: !!(defs.dual && defs.secondary) && !defs.singleOnly,
      primary: defs.primary,
      secondary: defs.secondary,
    };
  }

  function renderStickerAsset(type, scale, texts = {}) {
    switch (type) {
      case "special_offer":
        return renderSpecialOfferBadge(scale, texts);
      case "hot_sale":
        return renderHotSaleBurst(scale, texts);
      case "free_delivery":
        return renderFreeDeliverySticker(scale, texts);
      case "best_choice":
        return renderBestChoiceOfferBadge(scale, texts);
      case "limited_time":
        return renderLimitedTimeBadge(scale, texts);
      case "best_price":
        return renderBestPriceRibbon(scale, texts);
      case "flash_deal":
        return renderFlashDealBurst(scale, texts);
      case "super_offer":
        return renderSuperOfferBadge(scale, texts);
      case "flat_off":
        return renderFlatOffBadge(scale, texts);
      case "mega_sale":
        return renderMegaSaleBadge(scale, texts);
      default:
        return renderSpecialOfferBadge(scale, texts);
    }
  }

  function drawStickerSlotOnPhoto(ctx, border, photoW, photoH, assetType, slotLayout, scale) {
    if (!slotLayout) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const slotScale = slotLayout.scale || 1;
    if (slotLayout._image) {
      const maxW = photoW * 0.24 * slotScale;
      const ratio = slotLayout._image.height / Math.max(1, slotLayout._image.width);
      const drawW = maxW;
      const drawH = maxW * ratio;
      const x = border + photoW * slotLayout.x - drawW / 2;
      const y = border + photoH * slotLayout.y - drawH / 2;
      ctx.drawImage(slotLayout._image, x, y, drawW, drawH);
      return;
    }
    const texts = {};
    if (slotLayout.text1) texts.line1 = slotLayout.text1;
    if (slotLayout.text2) texts.line2 = slotLayout.text2;
    const rendered = renderStickerAsset(assetType, scale * slotScale, texts);
    const x = border + photoW * slotLayout.x - rendered.width / 2;
    const y = border + photoH * slotLayout.y - rendered.height / 2;
    ctx.drawImage(rendered.canvas, x, y, rendered.width, rendered.height);
  }

  function drawFramedOverlaysWithLayout(ctx, border, photoW, photoH, templateId, stickerLayout) {
    const template = normalizeStickerTemplate(templateId);
    if (template === "none") return;
    const layout = normalizeStickerLayout(stickerLayout, template);
    const scale = Math.max(0.78, Math.min(1.35, Math.min(photoW, photoH) / 900));
    for (const slot of layout.stickers) {
      drawStickerSlotOnPhoto(ctx, border, photoW, photoH, slot.type, slot, scale);
    }
  }

  function loadStickerImageElement(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  async function hydrateStickerLayoutImages(stickerLayout, templateId) {
    const layout = normalizeStickerLayout(stickerLayout, templateId);
    for (const slot of layout.stickers) {
      if (slot.imageUrl && !slot._image) {
        try {
          slot._image = await loadStickerImageElement(slot.imageUrl);
        } catch {
          slot.imageUrl = "";
        }
      }
    }
    return layout;
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
    const widthScale = resolveBorderWidthScale(style);
    const fitted = fitFramedPhotoDims(img.width, img.height, framedMaxSide, widthScale);
    const w = fitted.w;
    const h = fitted.h;

    const border = framedBorderPx(w, h, framedMaxSide, widthScale);
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
    drawFramedOverlays(ctx, border, w, h, style);
    return c;
  }

  async function prepareFramedCanvasForReframe(img, framedMaxSide = MEESHO_FRAMED_MAX_SIDE, frameStyle) {
    const style = { ...defaultFrameStyle(), ...(frameStyle || {}) };
    if (style.stickerLayout) {
      style.stickerLayout = await hydrateStickerLayoutImages(style.stickerLayout, style.stickerTemplate);
    }
    return prepareFramedCanvas(img, framedMaxSide, style);
  }

  async function prepareSupplierDenExactFramedCanvasForReframe(img, spec, frameStyle) {
    const style = { ...defaultFrameStyle(), ...(frameStyle || {}) };
    if (style.stickerLayout) {
      style.stickerLayout = await hydrateStickerLayoutImages(style.stickerLayout, style.stickerTemplate);
    }
    return prepareSupplierDenExactFramedCanvas(img, spec, style);
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

  /** Hard byte cap for reframe — quality downscale before exceeding original shipping slab. */
  async function compressBusyUnderBytes(canvas, maxBytes) {
    let best = null;
    let lo = 5;
    let hi = 98;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const blob = await blobAtCanvasQuality(canvas, mid / 100, 0.05);
      if (blob.size <= maxBytes) {
        best = blob;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best) return best;
    return blobAtCanvasQuality(canvas, 0.05, 0.05);
  }

  async function compressToByteCap(canvas, maxBytes, opts = {}) {
    const studio = !!opts.studio;
    const slabKb = opts.slabKb ?? opts.targetKb ?? Math.max(1, Math.ceil(maxBytes / 1024));

    if (!maxBytes || maxBytes <= 0) {
      if (studio) {
        return compressCanvas(canvas, slabKb * 1024, opts.minQ, opts.whiteRatio, true, opts.absMinQ);
      }
      return compressBusyToSlab(canvas, slabKb);
    }

    let blob;
    if (studio) {
      blob = await compressCanvas(canvas, maxBytes, opts.minQ, opts.whiteRatio, true, opts.absMinQ);
    } else {
      blob = await compressBusyToSlabOnce(canvas, Math.max(1, Math.ceil(maxBytes / 1024)));
    }
    if (blob.size <= maxBytes) return blob;

    blob = await compressBusyUnderBytes(canvas, maxBytes);
    if (blob.size <= maxBytes) return blob;

    let factor = 0.98;
    let fallback = blob;
    while (factor >= 0.82) {
      const scaled = scaleCanvas(canvas, factor);
      const candidate = await compressBusyUnderBytes(scaled, maxBytes);
      releaseCanvas(scaled);
      if (candidate.size <= maxBytes) return candidate;
      if (candidate.size < fallback.size) fallback = candidate;
      factor -= 0.02;
    }
    return fallback;
  }

  function cloneFrameStyleRecord(style) {
    if (!style) return null;
    const out = {
      borderColor: style.borderColor,
      stickerTemplate: style.stickerTemplate,
      borderWidthPreset: style.borderWidthPreset || "standard",
      borderWidthAdjust: style.borderWidthAdjust ?? 100,
    };
    if (style.stickerLayout) {
      out.stickerLayout = cloneStickerLayout(style.stickerLayout, style.stickerTemplate);
    }
    return out;
  }

  function finalizeReframeMetaAnchors(meta, variantStub) {
    if (!meta) return null;
    const tier = meta.tier || {};
    if (tier.anchorBytes) return meta;
    const anchorBytes = variantStub.bytes;
    const anchorInr = estimateMeeshoInr(variantStub);
    return {
      ...meta,
      baselineFrameStyle:
        meta.baselineFrameStyle ||
        cloneFrameStyleRecord(
          meta.frameStyle
            ? { ...meta.frameStyle, stickerLayout: null }
            : null
        ),
      tier: {
        ...tier,
        anchorBytes,
        anchorInr,
        preserveBytes: anchorBytes,
        preserveKb: tier.preserveKb ?? tier.slabKb ?? tier.targetKb ?? kb(anchorBytes),
      },
    };
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
    const capBytes = options.preserveBytes ?? null;
    const compressOpts = {
      studio: !!(profile.studio || profile.collageFramed),
      whiteRatio,
      absMinQ: profile.absMinQ,
      minQ,
      slabKb: tier.slabKb,
      targetKb: tier.targetKb,
    };
    const blob = capBytes
      ? await compressToByteCap(canvas, capBytes, compressOpts)
      : profile.studio || profile.collageFramed
        ? await compressCanvas(canvas, tier.targetKb * 1024, minQ, whiteRatio, true, profile.absMinQ)
        : await compressBusyToSlab(canvas, tier.slabKb);
    const label = options.showMode
      ? `[${profile.modeName || profile.id}] ${tier.label} · ${canvas.width}×${canvas.height}`
      : `${tier.label} · ${canvas.width}×${canvas.height}`;
    const variantStub = {
      bytes: blob.size,
      width: canvas.width,
      height: canvas.height,
      processingPath: profile.path,
      profileId: profile.id,
    };
    const reframeMeta = options.reframeMeta
      ? finalizeReframeMetaAnchors(options.reframeMeta, variantStub)
      : null;
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
      flatlayPriority: profile.flatlayPriority,
      reframeMeta,
    };
  }

  function buildReframeMeta(profile, tier, options = {}) {
    const layout = options.studioLayout ?? profile.studioLayout ?? null;
    let kind = "studio";
    if (layout && profile.collageFramed) kind = "collage_framed";
    else if (layout && profile.studio) kind = "collage_studio";
    else if (options.framedFromStudio) kind = "studio_framed_extra";
    else if (!profile.studio) kind = "framed_slab";

    const style = options.frameStyle;
    const baselineFrameStyle = style
      ? {
          borderColor: style.borderColor,
          stickerTemplate: style.stickerTemplate,
          borderWidthPreset: style.borderWidthPreset || "standard",
          borderWidthAdjust: style.borderWidthAdjust ?? 100,
          stickerLayout: null,
        }
      : null;
    return {
      kind,
      profileId: profile.id,
      processingPath: profile.path,
      studioLayout: layout,
      studioBase: profile.studio,
      framedMaxSide: profile.framedMaxSide ?? MEESHO_FRAMED_MAX_SIDE,
      tier: {
        targetKb: tier.targetKb ?? null,
        slabKb: tier.slabKb ?? null,
        preserveKb: tier.targetKb ?? tier.slabKb ?? null,
      },
      whiteRatio: options.whiteRatio ?? null,
      absMinQ: profile.absMinQ ?? null,
      baselineFrameStyle,
      frameStyle: style
        ? {
            borderColor: style.borderColor,
            stickerTemplate: style.stickerTemplate,
            borderWidthPreset: style.borderWidthPreset || "standard",
            borderWidthAdjust: style.borderWidthAdjust ?? 100,
            stickerLayout: style.stickerLayout || null,
          }
        : null,
    };
  }

  function findApparelLayoutSpec(layout, profileId) {
    const pid = String(profileId || "");
    if (pid.startsWith("supplierden_")) {
      return SUPPLIERDEN_TALL_LAYOUTS.find((s) => s.layout === layout);
    }
    if (pid.startsWith("full_length_")) return FULL_LENGTH_LAYOUTS.find((s) => s.layout === layout);
    if (pid.startsWith("model_")) return MODEL_PHOTO_LAYOUTS.find((s) => s.layout === layout);
    if (pid.startsWith("flatlay_")) return FLATLAY_LAYOUTS.find((s) => s.layout === layout);
    return null;
  }

  function resolveReframeBaseCanvas(sourceImg, meta) {
    if (meta.studioLayout) {
      const spec = findApparelLayoutSpec(meta.studioLayout, meta.profileId);
      if (spec) {
        const style = meta.frameStyle
          ? {
              borderColor: meta.frameStyle.borderColor,
              stickerTemplate: meta.frameStyle.stickerTemplate,
            }
          : null;
        if (String(meta.profileId || "").startsWith("supplierden_")) {
          return prepareSupplierDenLayoutCanvas(sourceImg, spec, style);
        }
        return prepareFlatlayLayoutCanvas(sourceImg, spec, style);
      }
      return prepareLingerieLayoutCanvas(sourceImg, meta.studioLayout);
    }
    const useStudio = meta.studioBase !== false && meta.kind !== "framed_slab";
    return prepareCanvas(
      sourceImg,
      useStudio,
      meta.framedMaxSide ?? MEESHO_FRAMED_MAX_SIDE,
      null
    );
  }

  /** Re-render one result — keeps original KB slab/target so ₹ does not jump on border/sticker edits. */
  async function renderCustomVariant(sourceImg, meta, displayMode, frameStyle) {
    await loadMozjpeg();
    const preserveKb = meta.tier?.preserveKb ?? meta.tier?.targetKb ?? meta.tier?.slabKb ?? 51;
    const preserveBytes =
      meta.tier?.anchorBytes ?? meta.tier?.preserveBytes ?? Math.round(preserveKb * 1024);
    const framedMode = displayMode === "framed" || displayMode === "frame_only";

    if (isSupplierDenProfileId(meta.profileId) && meta.studioLayout) {
      const spec = findApparelLayoutSpec(meta.studioLayout, meta.profileId);
      if (spec?.type === "exact_framed") {
        let style = parseFrameStyle(frameStyle);
        if (displayMode === "frame_only") {
          style = mergeFrameStyle(style, { stickerTemplate: "none" });
        }
        const canvas =
          displayMode === "studio"
            ? prepareSupplierDenExactStudioCanvas(sourceImg, spec)
            : style.stickerLayout
              ? await prepareSupplierDenExactFramedCanvasForReframe(sourceImg, spec, style)
              : prepareSupplierDenExactFramedCanvas(sourceImg, spec, style);
        const whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
        const profile = {
          id: meta.profileId,
          path: meta.processingPath,
          studio: displayMode === "studio",
          modeName: "custom tall dress",
        };
        const tier =
          displayMode === "studio"
            ? { targetKb: preserveKb, label: "custom" }
            : { slabKb: preserveKb, label: "custom" };
        return buildVariantForTier(canvas, whiteRatio, profile, tier, { preserveBytes });
      }
    }

    let canvas = resolveReframeBaseCanvas(sourceImg, meta);
    let whiteRatio =
      meta.whiteRatio ?? Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));

    let style = parseFrameStyle(frameStyle);
    if (displayMode === "frame_only") {
      style = mergeFrameStyle(style, { stickerTemplate: "none" });
    }

    if (framedMode) {
      canvas = style.stickerLayout
        ? await prepareFramedCanvasForReframe(canvas, meta.framedMaxSide ?? MEESHO_FRAMED_MAX_SIDE, style)
        : prepareFramedCanvas(canvas, meta.framedMaxSide ?? MEESHO_FRAMED_MAX_SIDE, style);
      whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
      const profile = {
        id: meta.profileId,
        path: meta.processingPath,
        studio: false,
        modeName: "custom framed",
      };
      const tier = { slabKb: preserveKb, label: "custom" };
      return buildVariantForTier(canvas, whiteRatio, profile, tier, { preserveBytes });
    }

    const profile = {
      id: meta.profileId,
      path: meta.processingPath,
      studio: true,
      absMinQ: meta.absMinQ ?? undefined,
      modeName: "custom studio",
    };
    const tier = { targetKb: preserveKb, label: "custom" };
    return buildVariantForTier(canvas, whiteRatio, profile, tier, { preserveBytes });
  }

  /** Studio-only modes — append framed copies without jumping to ₹66+ slabs. */
  async function appendStudioFramedExtras(img, profile, frameStyle, onProgress) {
    if (!profile.studio) return [];
    const studioCanvas = prepareCanvas(img, true, profile.framedMaxSide, frameStyle);
    const studioTier = profile.tiers?.find((t) => t.lowest) || profile.tiers?.[0];
    const slabKb = studioTier?.targetKb
      ? Math.min(63, Math.max(39, studioTier.targetKb + (studioTier.targetKb <= 45 ? 9 : 0)))
      : 48;
    const framedProfile = {
      id: `${profile.id}_framed_extra`,
      studio: false,
      path: "framed_compact",
      modeName: `${profile.modeName} · framed`,
      framedMaxSide: 1024,
    };
    const tier = { slabKb, label: `${slabKb}KB framed`, recommended: true };
    const combos = [
      { suffix: "promo", style: frameStyle },
      { suffix: "frame only", style: mergeFrameStyle(frameStyle, { stickerTemplate: "none" }) },
    ];
    const out = [];
    for (const combo of combos) {
      if (onProgress) onProgress(92, `Framed extra · ${combo.suffix}…`);
      const framedCanvas = prepareFramedCanvas(
        studioCanvas,
        1024,
        combo.style
      );
      const whiteRatio = Math.max(
        measureNearWhiteRatio(framedCanvas),
        measureWhiteRatio(framedCanvas)
      );
      out.push(
        await buildVariantForTier(framedCanvas, whiteRatio, framedProfile, tier, {
          showMode: true,
          reframeMeta: buildReframeMeta(framedProfile, tier, {
            frameStyle: combo.style,
            whiteRatio,
            framedFromStudio: true,
          }),
        })
      );
      releaseCanvas(framedCanvas);
      await yieldToMain();
    }
    return out;
  }

  async function buildVariants(canvas, whiteRatio, profile, onProgress, progressBase, progressSpan, options = {}) {
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
      built.push(
        await buildVariantForTier(canvas, whiteRatio, profile, tier, {
          reframeMeta: buildReframeMeta(profile, tier, {
            frameStyle: options.frameStyle,
            studioLayout: options.studioLayout,
            whiteRatio,
          }),
        })
      );
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
        allVariants.push(
          await buildVariantForTier(canvas, whiteRatio, profile, tier, {
            showMode: true,
            reframeMeta: buildReframeMeta(profile, tier, {
              frameStyle: profile.studio ? null : style,
              whiteRatio,
              framedFromStudio: false,
            }),
          })
        );
        done += 1;
        if (onProgress) {
          onProgress(
            10 + (done / totalSteps) * 82,
            `Ranked preview · ${done}/${totalSteps} strategies tested`
          );
        }
        await yieldToMain();
      }
      releaseCanvas(canvas);
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
    if (profile.flatlayApparel) {
      return optimizeFlatlayApparelAll(img, frameStyle, onProgress);
    }
    if (profile.modelPhoto) {
      return optimizeModelPhotoAll(img, frameStyle, onProgress);
    }
    if (profile.fullLength) {
      return optimizeFullLengthAll(img, frameStyle, onProgress);
    }
    if (profile.supplierDenAll) {
      return optimizeSupplierDenAll(img, frameStyle, onProgress, tagName);
    }
    if (onProgress) onProgress(15, `Running ${profile.modeName || profile.id}…`);
    const style = mergeFrameStyle(frameStyle, profile.frameStyleOverride);
    const canvas = prepareCanvas(img, profile.studio, profile.framedMaxSide, style);
    const whiteRatio = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
    const studioVariants = await buildVariants(
      canvas,
      whiteRatio,
      profile,
      onProgress,
      15,
      75,
      { frameStyle }
    );
    releaseCanvas(canvas);
    if (profile.studio) {
      const framedExtras = await appendStudioFramedExtras(img, profile, frameStyle, onProgress);
      return [...studioVariants, ...framedExtras];
    }
    return studioVariants;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function stripReframeMeta(result) {
    if (!result || !result.reframeMeta) return result;
    const { reframeMeta, ...rest } = result;
    return rest;
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
        reframeMeta: v.reframeMeta || null,
        [OPT_FLAG]: true,
        categoryName: tagName,
      });
      releaseVariantBlob(v);
      await yieldToMain(true);
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
    const isFlatlay = isFlatlayTagName(tagName);
    const isModelPhoto = isModelPhotoTagName(tagName);
    const isFullLength = isFullLengthTagName(tagName);
    const isSupplierDen = isSupplierDenTagName(tagName);
    const timeoutMs = isAuto
      ? AUTO_PROCESS_TIMEOUT_MS
      : isLingerie
        ? LINGERIE_PROCESS_TIMEOUT_MS
        : isFlatlay
          ? FLATLAY_PROCESS_TIMEOUT_MS
          : isModelPhoto
            ? MODEL_PHOTO_PROCESS_TIMEOUT_MS
            : isFullLength
              ? FULL_LENGTH_PROCESS_TIMEOUT_MS
              : isSupplierDen
                ? SUPPLIERDEN_PROCESS_TIMEOUT_MS
                : PROCESS_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    const checkCancelled = () => {
      const live = STORE.requests.get(id);
      if (!live || live.status === "cancelled") throw new Error("Cancelled");
    };
    const checkDeadline = () => {
      checkCancelled();
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
      const live = STORE.requests.get(id);
      if (!live || live.status !== "cancelled") {
        req.status = "failed";
        req.error = String(e);
        req.progressLabel = "Failed";
      }
      console.error("[own-api] processImage failed:", e);
    } finally {
      PROCESSING.delete(id);
      persistRequest(id, req);
      void deleteJobImage(id);
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
        body: {
          ok: true,
          api: "own",
          service: "own-api.js",
          processing: useServerProcessing ? "server" : "client",
          version: 94,
          platform: "cloudflare-static",
        },
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
      void saveJobImage(id, image).then(() => {
        void processImage(id, image, tagName, frameStyle);
      });
      return { status: 200, body: { requestId: id } };
    }

    const poll = path.match(/^\/api\/meesho\/request(?:-status)?\/([^/]+)$/);
    if (poll && method === "GET") {
      const id = poll[1];
      void resumeJobIfNeeded(id);
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
      if (req.status === "cancelled") {
        return {
          status: 200,
          body: {
            status: "failed",
            progress: req.progress || 0,
            progressLabel: "Cancelled",
            message: "Cancelled",
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

    const cancelMatch = path.match(/^\/api\/meesho\/cancel-request\/([^/]+)$/);
    if (cancelMatch && method === "POST") {
      const id = cancelMatch[1];
      const req = cancelRequest(id);
      if (!req) return { status: 404, body: { message: "Request not found" } };
      return { status: 200, body: { ok: true, status: req.status } };
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

  function resolveApiUrl(input) {
    const url = typeof input === "string" ? input : input?.url || "";
    const path = pathOf(url);
    if (!useServerProcessing || (!isProcessingRoute(path) && path !== "/api/health")) return null;
    const origin = String(window.__MEESHO_PROCESSOR_ORIGIN__ || location.origin).replace(/\/$/, "");
    try {
      const parsed = new URL(url, location.origin);
      return origin + parsed.pathname + parsed.search;
    } catch {
      return origin + path;
    }
  }

  function installNetworkShims() {
    window.fetch = async function (input, init) {
      const remoteUrl = resolveApiUrl(input);
      if (remoteUrl) return origFetch(remoteUrl, init);
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
      let _remoteUrl = null;
      let _intercept = false;

      const origOpen = xhr.open.bind(xhr);
      xhr.open = function (method, url, async, user, password) {
        _method = (method || "GET").toUpperCase();
        _path = pathOf(url);
        _remoteUrl = resolveApiUrl(url);
        _intercept = !_remoteUrl && isOwnRoute(_path);
        if (_remoteUrl) return origOpen(method, _remoteUrl, async !== false, user, password);
        if (_intercept) return origOpen(method, SHIM_URL, async !== false, user, password);
        return origOpen(method, url, async, user, password);
      };

      const origSend = xhr.send.bind(xhr);
      xhr.send = function (body) {
        if (_remoteUrl || !_intercept) return origSend(body);
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
  }

  window.__MEESHO_API_READY__ = initApiMode().then(async () => {
    installNetworkShims();
    await resumeInterruptedJobs();
    window.__MEESHO_USE_SERVER__ = useServerProcessing;
    console.info(
      useServerProcessing
        ? "[own-api] server processing — safe to switch apps; job tracked in background"
        : "[own-api] in-browser processing — switch apps OK; keep tab open for fastest runs"
    );
    return useServerProcessing;
  });

  window.__MEESHO_OWN_API__ = true;
  window.MeeshoProcessor = { optimize: optimizeForServer };
  window.MeeshoReframe = {
    renderCustomVariant,
    blobToDataUrl,
    estimateMeeshoInr,
    kb,
    loadMozjpeg,
  };
  window.MeeshoFrameSettings = {
    BORDER_PRESETS,
    BORDER_WIDTH_PRESETS,
    STICKER_TEMPLATES: STICKER_TEMPLATE_META,
    defaultFrameStyle,
    defaultStickerLayoutForTemplate,
    normalizeStickerLayout,
    cloneStickerLayout,
    newStickerSlot,
    templateHasDualStickers,
    getTemplateStickerSlotInfo,
    STICKER_ASSET_TYPES,
    REFRAME_MAX_STICKERS,
    normalizeBorderColor,
    normalizeStickerTemplate,
    normalizeBorderPreset,
    normalizeBorderWidthPreset,
    normalizeBorderWidthAdjust,
    resolveBorderWidthScale,
    hexToRgbComponents,
    STORAGE_KEYS: {
      border: FRAME_LS_BORDER,
      template: FRAME_LS_TEMPLATE,
      preset: FRAME_LS_PRESET,
    },
  };
  console.info("[own-api] browser API with local persistence; deploy via Cloudflare");
})();
