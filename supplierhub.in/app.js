/**
 * Meesho Image Generator — single index page only. No routes, no tabs.
 */
(function () {
  const MODES = [
    {
      id: "mo_studio",
      tagName: "White studio product",
      key: "studio",
      name: "Studio Compress",
      tag: "White or plain background",
      examples: "Bra, lingerie, catalogue shots on a clean studio background.",
      pill: "~20–26 KB · white canvas",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
    },
    {
      id: "mo_indoor",
      tagName: "Indoor busy background",
      key: "framed",
      name: "Framed Compress",
      tag: "Indoor or busy background",
      examples: "Raincoat, jacket, room or outdoor photos with busy backgrounds.",
      pill: "~91–93 KB · orange frame",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2" stroke="#ff7900" stroke-width="2.5"/><rect x="5" y="7" width="14" height="10" rx="1"/></svg>`,
    },
  ];

  let selected = null;
  let imageFile = null;
  let previewUrl = null;

  const app = document.getElementById("mo-app");

  function goHome() {
    if (location.pathname !== "/") {
      history.replaceState(null, "", "/");
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function setError(msg) {
    const el = document.getElementById("mo-error");
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove("mo-hidden");
    } else {
      el.classList.add("mo-hidden");
    }
  }

  function updateUi() {
    document.querySelectorAll(".mo-mode").forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.modeId === selected?.id);
    });
    const submit = document.getElementById("mo-submit");
    if (submit) submit.disabled = !selected || !imageFile;
  }

  function setImage(file) {
    if (!file?.type?.startsWith("image/")) {
      setError("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    imageFile = file;
    previewUrl = URL.createObjectURL(file);
    const drop = document.getElementById("mo-drop");
    if (!drop) return;
    drop.classList.add("has-image");
    drop.innerHTML = `<img src="${previewUrl}" alt="Preview" />`;
    setError("");
    updateUi();
  }

  function bindUpload() {
    const drop = document.getElementById("mo-drop");
    const input = document.getElementById("mo-file");
    if (!drop || !input) return;

    drop.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      if (input.files?.[0]) setImage(input.files[0]);
    });
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
  }

  function renderGenerator() {
    goHome();
    selected = null;
    imageFile = null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }

    app.innerHTML = `
      <section class="mo-hero">
        <h1>Meesho Image Generator</h1>
        <p>Choose compression mode, upload your product photo, download optimized JPEGs for Meesho.</p>
      </section>

      <section class="mo-card">
        <p class="mo-section-title">Step 1 · Compression mode</p>
        <div class="mo-modes" id="mo-modes">
          ${MODES.map(
            (m) => `
            <button type="button" class="mo-mode mo-mode--${m.key}" data-mode-id="${m.id}">
              <div class="mo-mode__head">
                <div class="mo-mode__icon">${m.icon}</div>
                <div>
                  <p class="mo-mode__name">${m.name}</p>
                  <p class="mo-mode__tag">${m.tag}</p>
                </div>
              </div>
              <p class="mo-mode__examples">${m.examples}</p>
              <span class="mo-mode__pill">${m.pill}</span>
            </button>`
          ).join("")}
        </div>

        <div class="mo-upload-wrap">
          <p class="mo-section-title">Step 2 · Upload product image</p>
          <div class="mo-drop" id="mo-drop">
            <div class="mo-drop__empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <strong>Drop image here or tap to browse</strong>
              <span>JPG, PNG, or WEBP</span>
            </div>
          </div>
          <input type="file" id="mo-file" accept="image/png,image/jpeg,image/webp" hidden />
        </div>

        <div class="mo-actions">
          <button type="button" class="mo-submit" id="mo-submit" disabled>Generate optimized images</button>
          <p class="mo-note">Shipping ₹ is an estimate from file size — verify on Meesho after upload.</p>
        </div>
        <div class="mo-error mo-hidden" id="mo-error"></div>
      </section>
    `;

    document.getElementById("mo-modes").addEventListener("click", (e) => {
      const btn = e.target.closest(".mo-mode");
      if (!btn) return;
      selected = MODES.find((m) => m.id === btn.dataset.modeId);
      setError("");
      updateUi();
    });

    document.getElementById("mo-submit").addEventListener("click", submit);
    bindUpload();
  }

  function renderProcessing(modeName) {
    goHome();
    app.innerHTML = `
      <section class="mo-card mo-processing">
        <div class="mo-spinner"></div>
        <h2>Optimizing your image…</h2>
        <p>Running <strong>${modeName || "compression"}</strong>. Usually 10–30 seconds.</p>
      </section>
    `;
  }

  function renderResults(results, modeName) {
    goHome();
    const cards = results
      .map((r, i) => {
        const name = `meesho-${r.fileSizeKb}kb-${i + 1}.jpg`;
        return `
        <article class="mo-result">
          <div class="mo-result__img">
            <img src="${r.imageUrl}" alt="Variant ${i + 1}" loading="lazy" />
          </div>
          <div class="mo-result__body">
            ${r.recommended ? '<span class="mo-result__badge">Recommended</span>' : ""}
            ${r.lowest ? '<span class="mo-result__badge">Smallest file</span>' : ""}
            <div class="mo-result__label">${escapeHtml(r.tagName || `Variant ${i + 1}`)}</div>
            <div class="mo-result__meta">Est. ~₹${r.estimatedShippingInr ?? r.fileSizeKb} · ${r.fileSizeKb} KB</div>
            <a class="mo-download" href="${r.imageUrl}" download="${name}">Download JPEG</a>
          </div>
        </article>`;
      })
      .join("");

    app.innerHTML = `
      <section class="mo-hero mo-hero--compact">
        <h1>Download your images</h1>
        <p>${escapeHtml(modeName || "Optimized")} · ${results.length} variants ready</p>
      </section>
      <section class="mo-card">
        <div class="mo-results-head">
          <button type="button" class="mo-back" id="mo-new">← New image</button>
        </div>
        <div class="mo-grid">${cards}</div>
      </section>
    `;

    document.getElementById("mo-new").addEventListener("click", renderGenerator);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function pollResults(requestId) {
    for (let i = 0; i < 180; i++) {
      const res = await fetch(`/api/meesho/request-status/${requestId}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (data.status === "completed" && data.results?.length) return data.results;
      if (data.status === "failed") throw new Error("Optimization failed. Try another photo or mode.");
      await sleep(1500);
    }
    throw new Error("Timed out. Please try again.");
  }

  async function submit() {
    if (!selected || !imageFile) {
      setError(!selected ? "Select a compression mode first." : "Upload a product image.");
      return;
    }
    setError("");
    renderProcessing(selected.name);

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

      const results = await pollResults(data.requestId);
      renderResults(results, selected.name);
    } catch (err) {
      renderGenerator();
      setError(err.message || "Something went wrong.");
    }
  }

  document.getElementById("mo-theme")?.addEventListener("click", () => {
    const dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", dark ? "dark" : "light");
  });

  goHome();
  renderGenerator();
})();
