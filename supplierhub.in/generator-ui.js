/**
 * Meesho Image Generator — simplified two-type UI (studio vs indoor).
 * Replaces the full Meesho category tree with clear product-type cards.
 */
(function () {
  const PAGE = "/meesho-image-generator";

  const TYPES = [
    {
      id: "mo_studio",
      tagName: "White studio product",
      title: "White studio",
      desc: "Bra, lingerie, panty, nightwear — plain white or grey studio background.",
      badge: "White canvas · ~20–26 KB",
      badgeClass: "studio",
      icon: "⚪",
      iconClass: "studio",
    },
    {
      id: "mo_indoor",
      tagName: "Indoor busy background",
      title: "Indoor / busy",
      desc: "Raincoat, jacket, room or outdoor photos — busy background, not plain white.",
      badge: "Orange frame · ~91–93 KB tier",
      badgeClass: "indoor",
      icon: "🟠",
      iconClass: "indoor",
    },
  ];

  let selected = null;
  let imageFile = null;
  let previewUrl = null;
  let busy = false;

  function onGeneratorPage() {
    return location.pathname.replace(/\/$/, "") === PAGE;
  }

  function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function setError(msg) {
    const box = document.getElementById("mo-gen-error");
    if (!box) return;
    box.textContent = msg || "";
    box.hidden = !msg;
  }

  function updateCards() {
    document.querySelectorAll(".mo-gen-card").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.typeId === selected?.id);
    });
    const btn = document.getElementById("mo-gen-submit");
    if (btn) btn.disabled = busy || !selected || !imageFile;
  }

  function setImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    imageFile = file;
    previewUrl = URL.createObjectURL(file);
    const drop = document.getElementById("mo-gen-drop");
    if (!drop) return;
    drop.classList.add("has-image");
    drop.innerHTML = `<img src="${previewUrl}" alt="Product preview" />`;
    setError("");
    updateCards();
  }

  async function submit() {
    if (busy || !selected || !imageFile) {
      setError(!selected ? "Choose a product photo type first." : "Upload a product image.");
      return;
    }
    busy = true;
    setError("");
    updateCards();
    const btn = document.getElementById("mo-gen-submit");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="mo-gen-loading">Optimizing…</span>';
    }

    try {
      const form = new FormData();
      form.append("tagId", selected.id);
      form.append("tagName", selected.tagName);
      form.append("image", imageFile);
      const res = await fetch("/api/meesho/getLowestShippingCharge", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Upload failed");
      if (!data.requestId) throw new Error("No request id returned");
      sessionStorage.setItem(
        "mo-gen-preview",
        JSON.stringify({ requestId: data.requestId, sourceImage: previewUrl, fromGeneration: true })
      );
      location.assign(`/generateImage/${data.requestId}`);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      busy = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Generate optimized images";
      }
      updateCards();
    }
  }

  function buildPanel() {
    const wrap = el("section", "", "");
    wrap.id = "mo-simple-generator";

    const panel = el("div", "mo-gen-panel");
    panel.innerHTML = `
      <div class="mo-gen-step">
        <span class="mo-gen-step__num">1</span>
        <span class="mo-gen-step__label">What kind of product photo is this?</span>
      </div>
    `;

    const grid = el("div", "mo-gen-types");
    TYPES.forEach((type) => {
      const card = el("button", "mo-gen-card", "");
      card.type = "button";
      card.dataset.typeId = type.id;
      card.innerHTML = `
        <div class="mo-gen-card__icon mo-gen-card__icon--${type.iconClass}">${type.icon}</div>
        <div class="mo-gen-card__title">${type.title}</div>
        <div class="mo-gen-card__desc">${type.desc}</div>
        <span class="mo-gen-card__badge mo-gen-card__badge--${type.badgeClass}">${type.badge}</span>
      `;
      card.addEventListener("click", () => {
        selected = type;
        setError("");
        updateCards();
      });
      grid.appendChild(card);
    });
    panel.appendChild(grid);

    const step2 = el("div", "mo-gen-step");
    step2.style.marginTop = "1.35rem";
    step2.innerHTML = `
      <span class="mo-gen-step__num">2</span>
      <span class="mo-gen-step__label">Upload your product image</span>
    `;
    panel.appendChild(step2);

    const drop = el("div", "mo-gen-drop");
    drop.id = "mo-gen-drop";
    drop.innerHTML = `
      <div class="mo-gen-drop__empty">
        <strong>Drop image here or click to browse</strong>
        <p>JPG, PNG, or WEBP · same photo you use on Meesho</p>
      </div>
    `;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.hidden = true;
    input.addEventListener("change", () => {
      if (input.files?.[0]) setImage(input.files[0]);
    });
    drop.appendChild(input);

    drop.addEventListener("click", () => input.click());
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("is-dragover");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-dragover"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("is-dragover");
      if (e.dataTransfer?.files?.[0]) setImage(e.dataTransfer.files[0]);
    });
    panel.appendChild(drop);

    const err = el("div", "mo-gen-error");
    err.id = "mo-gen-error";
    err.hidden = true;
    panel.appendChild(err);

    const actions = el("div", "mo-gen-actions");
    const submitBtn = el("button", "mo-gen-submit", "Generate optimized images");
    submitBtn.id = "mo-gen-submit";
    submitBtn.type = "button";
    submitBtn.disabled = true;
    submitBtn.addEventListener("click", submit);
    actions.appendChild(submitBtn);

    const hint = el(
      "p",
      "mo-gen-hint",
      "Pick the type that matches your photo — we apply the right compression path automatically. Verify final ₹ on Meesho after upload."
    );
    actions.appendChild(hint);
    panel.appendChild(actions);

    wrap.appendChild(panel);
    return wrap;
  }

  function patchPageCopy() {
    document.querySelectorAll("h1, h2, p, span, label").forEach((node) => {
      const t = node.textContent;
      if (!t) return;
      if (t.includes("Select a category & upload")) {
        node.textContent = "Choose product type & upload your image to get optimized Meesho shipping files.";
      }
      if (t.includes("Step 1 of 3 — Select a category")) {
        node.textContent = "Use the simple form below — no Meesho category search needed.";
      }
      if (t === "Shipment Analyser" && node.tagName === "H1") {
        node.textContent = "Meesho Image Generator";
      }
    });
  }

  function hideLegacyUi(root) {
    document.body.classList.add("mo-generator-simple");

    root.querySelectorAll("button").forEach((btn) => {
      const label = btn.textContent?.trim();
      if (label === "New Request" || label === "Cancel") {
        btn.closest(".relative.shrink-0")?.classList.add("mo-hide-legacy-picker");
      }
    });

    const observer = new MutationObserver(() => {
      root.querySelectorAll(".rounded-2xl.border.border-violet-200").forEach((box) => {
        if (box.querySelector('input[placeholder*="Sarees"]') || box.querySelector('[class*="h-[380px]"]')) {
          box.classList.add("mo-gen-legacy-form");
        }
      });
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function mount() {
    if (!onGeneratorPage()) return;
    const root = document.getElementById("root");
    if (!root) return;

    const tryInsert = () => {
      const main = root.querySelector("main");
      if (!main || document.getElementById("mo-simple-generator")) return !!main;

      const panel = buildPanel();
      const headingRow = main.querySelector(".flex.flex-col.sm\\:flex-row");
      if (headingRow?.nextElementSibling) {
        headingRow.parentNode.insertBefore(panel, headingRow.nextElementSibling);
      } else {
        main.prepend(panel);
      }

      patchPageCopy();
      hideLegacyUi(root);
      return true;
    };

    if (!tryInsert()) {
      const obs = new MutationObserver(() => {
        if (tryInsert()) obs.disconnect();
      });
      obs.observe(root, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  window.addEventListener("popstate", mount);
})();
