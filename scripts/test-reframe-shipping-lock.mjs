/**
 * Post-generation reframe edits (mode, color, template, border width) must keep
 * shipping locked to the generation anchor — same as sticker text/position edits.
 */
import { chromium } from "playwright";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] || "http://localhost:8000";

function startServer() {
  return spawn("python3", ["server.py"], { cwd: ROOT, stdio: "ignore" });
}

async function waitForServer(url) {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch(`${url}/`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server not ready");
}

async function run() {
  let server;
  if (BASE.includes("localhost")) {
    server = startServer();
    await waitForServer(BASE);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/?v=125`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.MeeshoFrameSettings && window.MeeshoReframe, { timeout: 20000 });

    const result = await page.evaluate(async () => {
      const MR = window.MeeshoReframe;
      const FS = window.MeeshoFrameSettings;

      const c = document.createElement("canvas");
      c.width = 900;
      c.height = 1400;
      const ctx = c.getContext("2d");
      for (let y = 0; y < 1400; y += 2) {
        for (let x = 0; x < 900; x += 2) {
          ctx.fillStyle = "rgb(" + (x % 255) + "," + (y % 255) + "," + ((x * y) % 255) + ")";
          ctx.fillRect(x, y, 2, 2);
        }
      }
      const jpeg = c.toDataURL("image/jpeg", 0.95);
      const loadImg = () =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = jpeg;
        });

      const baseline = {
        borderColor: "#7C3AED",
        stickerTemplate: "supplierden_match",
        borderWidthPreset: "standard",
        borderWidthAdjust: 100,
      };
      const meta0 = {
        kind: "framed_slab",
        profileId: "supplierden_50",
        processingPath: "supplierden_match_50",
        studioBase: false,
        framedMaxSide: 1024,
        baselineFrameStyle: { ...baseline, stickerLayout: null },
        frameStyle: { ...baseline },
        tier: { slabKb: 48, preserveKb: 48 },
      };

      const gen = await MR.renderCustomVariant(await loadImg(), meta0, "framed", baseline);
      const anchorInr = MR.estimateMeeshoInr(gen);
      const anchored = {
        ...meta0,
        tier: {
          slabKb: 48,
          preserveKb: 48,
          anchorBytes: gen.bytes,
          anchorInr,
          anchorWidth: gen.width,
          anchorHeight: gen.height,
          preserveBytes: gen.bytes,
        },
      };

      async function lockedInr(label, mode, style) {
        const v = await MR.renderCustomVariant(await loadImg(), anchored, mode, style);
        const raw = MR.estimateMeeshoInr({
          bytes: v.bytes,
          width: gen.width,
          height: gen.height,
          processingPath: anchored.processingPath,
          profileId: anchored.profileId,
        });
        const locked = MR.estimateReframeShippingInr(v, anchored);
        return {
          label,
          raw,
          locked,
          anchorInr,
          shippingLocked: locked === anchorInr,
          bytesWithinCap: v.bytes <= gen.bytes,
        };
      }

      const heavyLayout = FS.normalizeStickerLayout(
        FS.defaultStickerLayoutForTemplate("supplierden_match"),
        "supplierden_match"
      );
      heavyLayout.stickers.forEach((s, i) => {
        s.text1 = "EXTRA LONG TEXT " + i;
        s.text2 = "LINE TWO " + i;
      });

      const stickerImg = () => {
        const s = document.createElement("canvas");
        s.width = 320;
        s.height = 160;
        const sx = s.getContext("2d");
        for (let i = 0; i < 120; i++) {
          sx.fillStyle = "hsl(" + i * 3 + ",80%,50%)";
          sx.fillRect(Math.random() * 320, Math.random() * 160, 24, 18);
        }
        return s.toDataURL("image/png");
      };

      const customImageLayout = FS.normalizeStickerLayout(
        {
          version: 2,
          stickers: [
            { type: "mega_sale", x: 0.2, y: 0.2, text1: "MEGA", text2: "SALE", imageUrl: stickerImg() },
            { type: "hot_sale", x: 0.8, y: 0.25, text1: "HOT", text2: "NOW", imageUrl: stickerImg() },
            { type: "free_delivery", x: 0.5, y: 0.75, text1: "FREE", text2: "SHIP", imageUrl: stickerImg() },
          ],
        },
        "supplierden_match"
      );

      const removedOne = FS.normalizeStickerLayout(
        { version: 2, stickers: [heavyLayout.stickers[0]] },
        "supplierden_match"
      );

      const addedMulti = FS.normalizeStickerLayout(
        {
          version: 2,
          stickers: [
            { type: "free_delivery", x: 0.15, y: 0.2, text1: "FREE", text2: "DEL" },
            { type: "mega_sale", x: 0.82, y: 0.22, text1: "MEGA", text2: "SALE" },
            { type: "hot_sale", x: 0.5, y: 0.55, text1: "HOT", text2: "NOW" },
            { type: "limited_time", x: 0.25, y: 0.82, text1: "LIMITED", text2: "TIME" },
          ],
        },
        "supplierden_match"
      );

      const tightAnchored = {
        ...anchored,
        tier: {
          ...anchored.tier,
          anchorBytes: Math.floor(gen.bytes * 0.55),
          preserveBytes: Math.floor(gen.bytes * 0.55),
        },
      };

      async function lockedInrTight(label, mode, style) {
        const v = await MR.renderCustomVariant(await loadImg(), tightAnchored, mode, style);
        const raw = MR.estimateMeeshoInr({
          bytes: v.bytes,
          width: gen.width,
          height: gen.height,
          processingPath: anchored.processingPath,
          profileId: anchored.profileId,
        });
        const locked = MR.estimateReframeShippingInr(v, tightAnchored);
        return {
          label,
          raw,
          locked,
          anchorInr,
          shippingLocked: locked === anchorInr,
        };
      }

      return {
        anchorInr,
        color: await lockedInr("color", "framed", { ...baseline, borderColor: "#00FF00" }),
        template: await lockedInr("template", "framed", { ...baseline, stickerTemplate: "mega_sale" }),
        frameOnly: await lockedInr("frameOnly", "frame_only", { ...baseline, stickerTemplate: "none" }),
        studio: await lockedInr("studio", "studio", baseline),
        thick: await lockedInr("thick", "framed", {
          ...baseline,
          borderWidthPreset: "thick",
          borderWidthAdjust: 150,
        }),
        textPos: await lockedInr("textPos", "framed", { ...baseline, stickerLayout: heavyLayout }),
        customImages: await lockedInr("customImages", "framed", {
          ...baseline,
          stickerLayout: customImageLayout,
        }),
        removedSticker: await lockedInr("removedSticker", "framed", {
          ...baseline,
          stickerLayout: removedOne,
        }),
        addedMulti: await lockedInr("addedMulti", "framed", {
          ...baseline,
          stickerLayout: addedMulti,
        }),
        iconTypeSwap: await lockedInr("iconTypeSwap", "framed", {
          ...baseline,
          stickerLayout: FS.normalizeStickerLayout(
            {
              version: 2,
              stickers: heavyLayout.stickers.map((slot, i) =>
                Object.assign({}, slot, { type: i === 0 ? "free_delivery" : i === 1 ? "hot_sale" : slot.type, imageUrl: "" })
              ),
            },
            "supplierden_match"
          ),
        }),
        sizePxEdit: await lockedInr("sizePxEdit", "framed", {
          ...baseline,
          stickerLayout: FS.normalizeStickerLayout(
            {
              version: 2,
              stickers: heavyLayout.stickers.map((slot, i) =>
                Object.assign({}, slot, { sizePx: i === 0 ? 96 : i === 1 ? 140 : slot.sizePx })
              ),
            },
            "supplierden_match"
          ),
        }),
        customImageSizePx: await lockedInr("customImageSizePx", "framed", {
          ...baseline,
          stickerLayout: FS.normalizeStickerLayout(
            {
              version: 2,
              stickers: [
                {
                  type: "mega_sale",
                  x: 0.2,
                  y: 0.2,
                  text1: "MEGA",
                  text2: "SALE",
                  imageUrl: stickerImg(),
                  sizePx: 120,
                },
              ],
            },
            "supplierden_match"
          ),
        }),
        hiddenStickers: await lockedInr("hiddenStickers", "framed", {
          ...baseline,
          stickerLayout: FS.normalizeStickerLayout(
            {
              version: 2,
              stickers: addedMulti.stickers.map((slot, i) =>
                Object.assign({}, slot, { hidden: i < 2 })
              ),
            },
            "supplierden_match"
          ),
        }),
        hiddenKeepsSlots: await (async () => {
          const hiddenLayout = FS.normalizeStickerLayout(
            {
              version: 2,
              stickers: addedMulti.stickers.map((slot) => Object.assign({}, slot, { hidden: true })),
            },
            "supplierden_match"
          );
          const visible = await MR.renderCustomVariant(await loadImg(), anchored, "framed", {
            ...baseline,
            stickerLayout: addedMulti,
          });
          const hidden = await MR.renderCustomVariant(await loadImg(), anchored, "framed", {
            ...baseline,
            stickerLayout: hiddenLayout,
          });
          const hiddenLocked = MR.estimateReframeShippingInr(hidden, anchored);
          return {
            slotCount: hiddenLayout.stickers.length,
            allHidden: hiddenLayout.stickers.every((slot) => slot.hidden),
            visibleBytes: visible.bytes,
            hiddenBytes: hidden.bytes,
            hiddenLocked,
            shippingLocked: hiddenLocked === anchorInr,
            hiddenSmallerOrEqual: hidden.bytes <= visible.bytes,
          };
        })(),
        tightCustomImages: await lockedInrTight("tightCustomImages", "framed", {
          ...baseline,
          stickerLayout: customImageLayout,
        }),
        tightColor: await lockedInrTight("tightColor", "framed", { ...baseline, borderColor: "#FF5500" }),
        tightTemplate: await lockedInrTight("tightTemplate", "framed", {
          ...baseline,
          stickerTemplate: "limited_time",
        }),
        customizedMetaOnly: await (async () => {
          const stripped = {
            ...anchored,
            tier: {
              slabKb: 48,
              preserveKb: 48,
              anchorWidth: gen.width,
              anchorHeight: gen.height,
            },
            anchorEstimatedShippingInr: anchorInr,
            anchorFileSizeBytes: gen.bytes,
          };
          const v = await MR.renderCustomVariant(await loadImg(), stripped, "framed", {
            ...baseline,
            stickerLayout: customImageLayout,
          });
          const locked = MR.estimateReframeShippingInr(v, stripped);
          return {
            label: "customizedMetaOnly",
            locked,
            anchorInr,
            shippingLocked: locked === anchorInr,
          };
        })(),
        iconPreviewApi: await (async () => {
          const freeUrl = FS.renderStickerIconPreview("free_delivery", 76);
          const label = FS.stickerSlotIconLabel({ type: "free_delivery", imageUrl: "" });
          const customLabel = FS.stickerSlotIconLabel({ type: "free_delivery", imageUrl: "data:image/png;base64,abc" });
          return {
            hasPreview: typeof freeUrl === "string" && freeUrl.indexOf("data:image") === 0,
            label,
            customLabel,
          };
        })(),
        customIconAnchorStable: await (async () => {
          const customSlot = {
            type: "free_delivery",
            x: 0.2,
            y: 0.2,
            text1: "FREE",
            text2: "DEL",
            imageUrl: stickerImg(),
            sizePx: 120,
          };
          const customLayout = FS.normalizeStickerLayout(
            { version: 2, stickers: [customSlot] },
            "supplierden_match"
          );
          const revertedLayout = FS.normalizeStickerLayout(
            {
              version: 2,
              stickers: [{ ...customSlot, imageUrl: "", type: "free_delivery", sizePx: 120 }],
            },
            "supplierden_match"
          );
          const resizedLayout = FS.normalizeStickerLayout(
            {
              version: 2,
              stickers: [{ ...customSlot, sizePx: 96 }],
            },
            "supplierden_match"
          );
          const metaFrozen = {
            ...anchored,
            anchorFrozen: true,
            anchorFileSizeBytes: gen.bytes,
            anchorEstimatedShippingInr: anchorInr,
            tier: {
              ...anchored.tier,
              anchorBytes: gen.bytes,
              anchorInr,
              preserveBytes: gen.bytes,
            },
          };
          const customV = await MR.renderCustomVariant(await loadImg(), metaFrozen, "framed", {
            ...baseline,
            stickerLayout: customLayout,
          });
          const resizedV = await MR.renderCustomVariant(await loadImg(), metaFrozen, "framed", {
            ...baseline,
            stickerLayout: resizedLayout,
          });
          const revertedV = await MR.renderCustomVariant(await loadImg(), metaFrozen, "framed", {
            ...baseline,
            stickerLayout: revertedLayout,
          });
          MR.enforceReframeFrozenAnchors(metaFrozen);
          const poisoned = {
            ...metaFrozen,
            tier: {
              ...metaFrozen.tier,
              anchorBytes: customV.bytes,
              anchorInr: MR.estimateMeeshoInr(customV),
            },
          };
          MR.enforceReframeFrozenAnchors(poisoned);
          return {
            lockedCustom: MR.estimateReframeShippingInr(customV, metaFrozen),
            lockedResized: MR.estimateReframeShippingInr(resizedV, metaFrozen),
            lockedReverted: MR.estimateReframeShippingInr(revertedV, metaFrozen),
            shippingLockedCustom: MR.estimateReframeShippingInr(customV, metaFrozen) === anchorInr,
            shippingLockedResized: MR.estimateReframeShippingInr(resizedV, metaFrozen) === anchorInr,
            shippingLockedReverted: MR.estimateReframeShippingInr(revertedV, metaFrozen) === anchorInr,
            anchorBytesRestored: poisoned.tier.anchorBytes === gen.bytes,
            anchorInrRestored: poisoned.tier.anchorInr === anchorInr,
            customWithinCap: customV.bytes <= gen.bytes,
            resizedWithinCap: resizedV.bytes <= gen.bytes,
          };
        })(),
      };
    });

    const checks = [
      result.color,
      result.template,
      result.frameOnly,
      result.studio,
      result.thick,
      result.textPos,
      result.tightColor,
      result.tightTemplate,
      result.customImages,
      result.removedSticker,
      result.addedMulti,
      result.sizePxEdit,
      result.iconTypeSwap,
      result.customImageSizePx,
      result.hiddenStickers,
      result.tightCustomImages,
      result.customizedMetaOnly,
    ];
    const ok =
      checks.every((c) => c.shippingLocked) &&
      result.hiddenKeepsSlots.slotCount === 4 &&
      result.hiddenKeepsSlots.allHidden &&
      result.hiddenKeepsSlots.shippingLocked &&
      result.iconPreviewApi.hasPreview &&
      result.iconPreviewApi.label === "Free delivery" &&
      result.iconPreviewApi.customLabel === "Custom icon" &&
      result.customIconAnchorStable.shippingLockedCustom &&
      result.customIconAnchorStable.shippingLockedResized &&
      result.customIconAnchorStable.shippingLockedReverted &&
      result.customIconAnchorStable.anchorBytesRestored &&
      result.customIconAnchorStable.anchorInrRestored;

    if (!ok) {
      console.error("FAIL", result);
      process.exit(1);
    }
    console.log("OK", JSON.stringify(result));
  } finally {
    await browser.close();
    if (server) server.kill("SIGTERM");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
