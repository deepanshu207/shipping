/**
 * Replaces any leftover third-party brand text after React renders.
 */
(function () {
  const FROM = [
    /SupplierHub/gi,
    /Supplier Hub/gi,
    /SupplierDen/gi,
    /supplierhub\.in/gi,
    /support@supplierhub\.in/gi,
  ];
  const TO = ["Meesho Optimizer", "Meesho Optimizer", "Meesho Optimizer", "", "support@local"];

  function patchNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let t = node.textContent;
      FROM.forEach((re, i) => {
        t = t.replace(re, TO[i]);
      });
      if (t !== node.textContent) node.textContent = t;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.title) {
      FROM.forEach((re, i) => {
        node.title = node.title.replace(re, TO[i]);
      });
    }
    node.childNodes.forEach(patchNode);
  }

  function run() {
    patchNode(document.body);
    document.querySelectorAll('meta[content*="Supplier"], meta[content*="supplierhub"]').forEach((el) => {
      let c = el.getAttribute("content") || "";
      FROM.forEach((re, i) => {
        c = c.replace(re, TO[i]);
      });
      el.setAttribute("content", c);
    });
    document.querySelectorAll("title").forEach((el) => {
      FROM.forEach((re, i) => {
        el.textContent = el.textContent.replace(re, TO[i]);
      });
    });
  }

  const obs = new MutationObserver(() => run());
  window.addEventListener("DOMContentLoaded", () => {
    run();
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
