/**
 * Meesho Optimizer — runtime branding: logos, text cleanup, theme hooks.
 */
(function () {
  const BRAND = "Meesho Optimizer";
  const LOGO_MARK = "/logo-mark.svg?v=2";
  const LOGO_FULL = "/logo.svg?v=2";
  const TRUCK_PATH = "M13 14H6V5h7v9z";

  const TEXT_FROM = [
    [/SupplierHub/gi, BRAND],
    [/Supplier Hub/gi, BRAND],
    [/SupplierDen/gi, BRAND],
    [/supplierhub\.in/gi, ""],
    [/support@supplierhub\.in/gi, "support@local"],
    [/Piyush416/gi, BRAND],
  ];

  let logoTimer = null;

  function patchText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let t = node.textContent;
      TEXT_FROM.forEach(([re, to]) => {
        t = t.replace(re, to);
      });
      if (t !== node.textContent) node.textContent = t;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    ["title", "aria-label"].forEach((attr) => {
      const v = node.getAttribute(attr);
      if (!v) return;
      let next = v;
      TEXT_FROM.forEach(([re, to]) => {
        next = next.replace(re, to);
      });
      if (next !== v) node.setAttribute(attr, next);
    });
    node.childNodes.forEach(patchText);
  }

  function isTruckSvg(svg) {
    if (!svg || svg.tagName !== "svg") return false;
    const path = svg.querySelector(`path[d="${TRUCK_PATH}"]`);
    return !!path;
  }

  function makeLogoBox(size) {
    const box = document.createElement("div");
    box.className = "mo-logo-box";
    box.dataset.moLogo = "1";
    if (size) {
      box.style.width = size + "px";
      box.style.height = size + "px";
    }
    const img = document.createElement("img");
    img.src = LOGO_MARK;
    img.alt = BRAND;
    img.className = "mo-logo-mark";
    img.width = size || 36;
    img.height = size || 36;
    box.appendChild(img);
    return box;
  }

  function styleBrandName(el) {
    if (!el || el.dataset.moBrand) return;
    if (el.textContent.trim() !== BRAND) return;
    el.classList.add("mo-brand-name");
    el.dataset.moBrand = "1";
  }

  function replaceTruckLogos() {
    document.querySelectorAll("svg").forEach((svg) => {
      if (!isTruckSvg(svg)) return;

      const host = svg.closest('[class*="shadow-violet"]');
      if (!host || host.dataset.moLogo) return;

      const size = host.classList.toString().includes("w-") ? 36 : 36;
      host.replaceWith(makeLogoBox(size));
    });

    document.querySelectorAll("a, div, span").forEach((el) => {
      if (el.childNodes.length === 1 && el.textContent.trim() === BRAND) {
        styleBrandName(el);
      }
      if (el.textContent.trim() === BRAND && el.querySelector(".mo-logo-box")) {
        el.classList.add("mo-brand-link");
      }
    });

    document.querySelectorAll(`a[href="/"], a[href="/meesho-image-generator"]`).forEach((link) => {
      const hasLogo = link.querySelector(".mo-logo-box, [data-mo-logo]");
      const hasName = link.textContent.includes(BRAND);
      if (hasLogo && hasName) link.classList.add("mo-brand-link");
    });
  }

  function patchMeta() {
    document.querySelectorAll("title").forEach((el) => {
      TEXT_FROM.forEach(([re, to]) => {
        el.textContent = el.textContent.replace(re, to);
      });
    });
    document.querySelectorAll('meta[name], meta[property]').forEach((el) => {
      const c = el.getAttribute("content");
      if (!c) return;
      let next = c;
      TEXT_FROM.forEach(([re, to]) => {
        next = next.replace(re, to);
      });
      if (next !== c) el.setAttribute("content", next);
    });
  }

  function run() {
    patchText(document.body);
    patchMeta();
    replaceTruckLogos();
  }

  function schedule() {
    if (logoTimer) clearTimeout(logoTimer);
    logoTimer = setTimeout(run, 50);
  }

  window.addEventListener("DOMContentLoaded", () => {
    run();
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  window.__MO_BRAND = { name: BRAND, logo: LOGO_MARK, logoFull: LOGO_FULL };
})();
