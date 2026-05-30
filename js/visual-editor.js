/**
 * THE CLOVER — Visual on-site editor
 * Edit the real storefront like Framer / Shopify theme editor
 */
(function () {
  "use strict";

  if (typeof CloverCMS === "undefined" || typeof CloverVE === "undefined") return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let editOn = true;
  let panelEl = null;
  let mediaTarget = null;

  function toast(msg) {
    const t = $("#toast") || $("#admToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("is-visible");
    setTimeout(() => t.classList.remove("is-visible"), 2400);
  }

  function setNested(obj, path, value) {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      cur[keys[i]] = cur[keys[i]] ?? {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  function getNested(obj, path) {
    return path.split(".").reduce((o, k) => o?.[k], obj);
  }

  function saveCms(mutator) {
    const data = CloverCMS.get();
    mutator(data);
    CloverCMS.save(data);
  }

  /* ——— Toolbar ——— */
  function buildToolbar() {
    if ($("#veToolbar")) return;
    const bar = document.createElement("div");
    bar.id = "veToolbar";
    bar.className = "ve-toolbar";
    bar.innerHTML = `
      <div class="ve-toolbar__brand">THE CLOVER <span>Visual Editor</span></div>
      <div class="ve-toolbar__center">
        <label class="ve-toggle"><input type="checkbox" id="veEditToggle" checked /> Edit Mode</label>
        <button type="button" class="ve-btn" id="veUndo" title="Undo">↶ Undo</button>
        <button type="button" class="ve-btn" id="veRedo" title="Redo">↷ Redo</button>
        <button type="button" class="ve-btn" id="vePreview">Preview</button>
        <button type="button" class="ve-btn" id="veMedia">Media</button>
      </div>
      <div class="ve-toolbar__right">
        <button type="button" class="ve-btn ve-btn--primary" id="vePublish">Publish</button>
        <button type="button" class="ve-btn" id="veSignOut">Sign out</button>
      </div>`;
    document.body.prepend(bar);

    const banner = document.createElement("div");
    banner.className = "ve-draft-banner";
    banner.id = "veDraftBanner";
    banner.textContent = "Draft — changes not live until you Publish";
    document.body.appendChild(banner);

    $("#veEditToggle").onchange = (e) => {
      editOn = e.target.checked;
      document.body.classList.toggle("ve-editing", editOn && !CloverVE.isPreview());
      if (editOn) bindAll();
    };

    $("#vePreview").onclick = () => {
      const next = !CloverVE.isPreview();
      CloverVE.setPreview(next);
      document.body.classList.toggle("ve-preview", next);
      document.body.classList.toggle("ve-editing", editOn && !next);
      $("#vePreview").textContent = next ? "Exit preview" : "Preview";
      location.reload();
    };

    $("#vePublish").onclick = () => {
      if (confirm("Publish all draft changes to the live storefront?")) {
        CloverVE.publish();
        toast("Published! Customers now see your changes.");
        $("#veDraftBanner").textContent = "Published just now";
        setTimeout(() => {
          $("#veDraftBanner").textContent = "Draft — changes not live until you Publish";
        }, 3000);
      }
    };

    $("#veUndo").onclick = () => {
      if (CloverVE.undo()) {
        toast("Undone");
        location.reload();
      }
    };

    $("#veRedo").onclick = () => {
      if (CloverVE.redo()) {
        toast("Redone");
        location.reload();
      }
    };

    $("#veMedia").onclick = openMediaDrawer;
    $("#veSignOut").onclick = () => {
      CloverCMS.logout();
      CloverVE.disableEdit();
      location.href = "admin.html";
    };
  }

  /* ——— Text inline editing ——— */
  function bindText(el) {
    if (el.dataset.veBound) return;
    el.dataset.veBound = "1";
    const path = el.dataset.ve;
    if (!path) return;

    const badge = document.createElement("span");
    badge.className = "ve-badge";
    badge.textContent = path.split(".").pop();
    el.appendChild(badge);

    el.addEventListener("click", (e) => {
      if (!editOn || CloverVE.isPreview()) return;
      if (el.dataset.veHtml === "1") return;
      e.preventDefault();
      el.contentEditable = "true";
      el.focus();
      el.classList.add("ve-focused");
    });

    el.addEventListener("blur", () => {
      el.contentEditable = "false";
      el.classList.remove("ve-focused");
      const html = el.dataset.veHtml === "1";
      const val = html ? el.innerHTML : el.textContent.trim();
      saveCms((d) => setNested(d, path, val));
      toast("Saved");
    });

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !el.dataset.veMultiline) {
        e.preventDefault();
        el.blur();
      }
    });
  }

  /* ——— Media (images & video) ——— */
  function wrapMedia(el, label) {
    if (el.closest(".ve-media-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "ve-media-wrap";
    wrap.dataset.veMedia = label || "media";
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);

    const badge = document.createElement("span");
    badge.className = "ve-badge";
    badge.textContent = label || "Image";
    wrap.appendChild(badge);

    const tb = document.createElement("div");
    tb.className = "ve-media-toolbar";
    tb.innerHTML = `
      <button type="button" data-act="replace">Replace</button>
      <button type="button" data-act="upload">Upload</button>
      <button type="button" data-act="url">URL</button>
      ${el.tagName === "VIDEO" ? `<button type="button" data-act="remove">Remove</button>` : `<button type="button" data-act="delete">Delete</button>`}
    `;
    wrap.appendChild(tb);

    tb.querySelectorAll("button").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (!editOn) return;
        const act = btn.dataset.act;
        const cmsPath = wrap.dataset.veCms;
        if (act === "replace" || act === "upload") {
          mediaTarget = { el, wrap, cmsPath };
          const inp = document.createElement("input");
          inp.type = "file";
          inp.accept = el.tagName === "VIDEO" ? "video/*" : "image/*";
          inp.onchange = async () => {
            const file = inp.files[0];
            if (!file) return;
            try {
              const meta = await CloverMedia.upload(file, el.tagName === "VIDEO" ? "Hero Videos" : "Product Images");
              const url = await CloverMedia.getBlobUrl(meta.id);
              applyMediaSrc(el, url || file.name, cmsPath, meta);
            } catch (err) {
              const reader = new FileReader();
              reader.onload = () => applyMediaSrc(el, reader.result, cmsPath);
              reader.readAsDataURL(file);
            }
          };
          inp.click();
        } else if (act === "url") {
          const url = prompt("Image or video URL", el.src || "");
          if (url) applyMediaSrc(el, url, cmsPath);
        } else if (act === "delete" || act === "remove") {
          if (el.tagName === "VIDEO" && cmsPath) {
            saveCms((d) => {
              setNested(d, cmsPath + ".videoEnabled", false);
              setNested(d, cmsPath + ".videoSrc", "");
            });
            el.remove();
          } else {
            el.style.opacity = "0.3";
          }
          toast("Updated");
        }
      };
    });
  }

  function applyMediaSrc(el, src, cmsPath, meta) {
    if (el.tagName === "VIDEO") {
      el.src = src;
      el.load();
    } else {
      el.src = src;
    }
    if (cmsPath) {
      const key = el.tagName === "VIDEO" ? "videoSrc" : "imageSrc";
      saveCms((d) => {
        setNested(d, cmsPath + "." + key, meta?.url || src);
        if (el.tagName === "VIDEO") setNested(d, cmsPath + ".videoEnabled", true);
      });
    }
    toast("Media updated");
  }

  /* ——— Product panel ——— */
  function openProductPanel(productId) {
    const p = CloverStore.getProduct(productId);
    if (!p) return;

    if (!panelEl) {
      panelEl = document.createElement("aside");
      panelEl.className = "ve-panel";
      panelEl.id = "vePanel";
      panelEl.innerHTML = `<div class="ve-panel__head"><h2 id="vePanelTitle">Edit product</h2><button type="button" class="ve-btn" id="vePanelClose">×</button></div>
        <div class="ve-panel__body" id="vePanelBody"></div>
        <div class="ve-panel__foot"><button type="button" class="ve-btn" id="vePanelCancel">Cancel</button><button type="button" class="ve-btn ve-btn--primary" id="vePanelSave">Save</button></div>`;
      document.body.appendChild(panelEl);
      $("#vePanelClose").onclick = closePanel;
      $("#vePanelCancel").onclick = closePanel;
    }

    $("#vePanelTitle").textContent = p.name;
    const v0 = p.variants[0];
    const cats = CloverCMS.getCategories().filter((c) => c.id !== "all");

    $("#vePanelBody").innerHTML = `
      <div class="ve-panel__field"><label>Product name</label><input id="vpName" value="${escAttr(p.name)}" /></div>
      <div class="ve-panel__field"><label>Description</label><textarea id="vpDesc" rows="4">${escAttr(p.description)}</textarea></div>
      <div class="ve-panel__field"><label>Category</label><select id="vpCat">${cats.map((c) => `<option value="${c.id}" ${p.category === c.id ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
      <div class="ve-panel__field"><label>Tags (comma)</label><input id="vpTags" value="${escAttr((p.tags || []).join(", "))}" /></div>
      <div class="ve-panel__field"><label><input type="checkbox" id="vpFeat" ${p.featured ? "checked" : ""} /> Featured</label></div>
      <hr style="margin:1rem 0;border:none;border-top:1px solid #e2e8f0" />
      <h3 style="font-size:0.9rem;margin-bottom:0.75rem">Color: ${escAttr(v0.name)}</h3>
      <div class="ve-panel__field"><label>Color name</label><input id="vpColorName" value="${escAttr(v0.name)}" /></div>
      <div class="ve-panel__field"><label>Hex</label><input type="color" id="vpHex" value="${v0.hex || "#000"}" /></div>
      <div class="ve-panel__field"><label>Price ($)</label><input type="number" id="vpPrice" value="${v0.price}" step="0.01" /></div>
      <div class="ve-panel__field"><label>Sale price ($)</label><input type="number" id="vpSale" value="${v0.salePrice ?? ""}" placeholder="Optional" step="0.01" /></div>
      <div class="ve-panel__field"><label>Stock XS,S,M,L,XL</label><input id="vpStock" value="${["XS", "S", "M", "L", "XL"].map((s) => v0.stock?.[s] ?? 0).join(",")}" /></div>
      <div class="ve-panel__field"><label>Images (one URL per line — this color only)</label><textarea id="vpImages" rows="4">${(v0.images || []).map((i) => i.src).join("\n")}</textarea></div>
      <p style="font-size:0.75rem;color:#64748b">Each color variant has its own gallery. Customers only see images for the selected color.</p>
      <a href="product.html?id=${encodeURIComponent(p.id)}" target="_blank" style="font-size:0.85rem;color:#6ec1e4">Open full product page →</a>
    `;

    $("#vePanelSave").onclick = () => {
      const updated = JSON.parse(JSON.stringify(p));
      updated.name = $("#vpName").value.trim();
      updated.description = $("#vpDesc").value.trim();
      updated.category = $("#vpCat").value;
      updated.tags = $("#vpTags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      updated.featured = $("#vpFeat").checked;
      const vi = 0;
      updated.variants[vi].name = $("#vpColorName").value.trim();
      updated.variants[vi].hex = $("#vpHex").value;
      updated.variants[vi].price = parseFloat($("#vpPrice").value) || 0;
      const sale = $("#vpSale").value;
      updated.variants[vi].salePrice = sale ? parseFloat(sale) : null;
      const stocks = $("#vpStock").value.split(",").map((n) => parseInt(n.trim(), 10) || 0);
      ["XS", "S", "M", "L", "XL"].forEach((s, i) => (updated.variants[vi].stock[s] = stocks[i] ?? 0));
      updated.variants[vi].images = $("#vpImages")
        .value.split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((src, i) => ({ src, label: `Image ${i + 1}` }));

      CloverStore.saveProduct(updated);
      CloverCMS.log("ve_product_edit", updated.id);
      toast("Product saved");
      closePanel();
      refreshProductGrids();
      if (window.CloverPDP?.refresh) window.CloverPDP.refresh();
    };

    panelEl.classList.add("is-open");
  }

  function closePanel() {
    panelEl?.classList.remove("is-open");
  }

  function escAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function bindProductCards() {
    $$(".product-card").forEach((card) => {
      const link = card.querySelector(".product-card__link");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      const m = href.match(/id=([^&]+)/);
      if (!m) return;
      const id = decodeURIComponent(m[1]);
      card.dataset.veProduct = id;

      if (!card.querySelector(".ve-product-edit")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ve-product-edit";
        btn.innerHTML = "✎";
        btn.title = "Edit product";
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openProductPanel(id);
        };
        card.querySelector(".product-card__img")?.appendChild(btn);
      }

      const nameEl = card.querySelector(".product-card__name");
      const priceEl = card.querySelector(".product-card__price");
      if (nameEl && !nameEl.dataset.vePrice) {
        nameEl.dataset.vePrice = id;
        nameEl.addEventListener("dblclick", (e) => {
          if (!editOn) return;
          e.preventDefault();
          e.stopPropagation();
          const p = CloverStore.getProduct(id);
          const n = prompt("Product name", p.name);
          if (n) {
            CloverStore.updateProduct(id, { name: n });
            nameEl.textContent = n;
            toast("Name saved");
          }
        });
      }
      if (priceEl) {
        priceEl.addEventListener("dblclick", (e) => {
          if (!editOn) return;
          e.preventDefault();
          e.stopPropagation();
          const p = CloverStore.getProduct(id);
          const pr = prompt("Base price", String(p.variants[0]?.price ?? 0));
          if (pr != null) {
            const prod = CloverStore.getProduct(id);
            prod.variants[0].price = parseFloat(pr) || 0;
            CloverStore.saveProduct(prod);
            refreshProductGrids();
            toast("Price saved");
          }
        });
      }
    });
  }

  function refreshProductGrids() {
    if (document.body.dataset.page === "home" && typeof window.__homeRefresh === "function") window.__homeRefresh();
    if (document.body.dataset.page === "shop" && typeof window.__shopRefresh === "function") window.__shopRefresh();
  }

  /* ——— Drag sort products ——— */
  function bindSortable() {
    const grids = $$("#specialProducts, #shopGrid");
    grids.forEach((grid) => {
      if (!grid || grid.dataset.veSort) return;
      grid.dataset.veSort = "1";
      grid.classList.add("ve-sortable");

      let dragEl = null;
      grid.querySelectorAll(".product-card").forEach((card) => {
        card.draggable = true;
        card.ondragstart = () => {
          dragEl = card;
          card.classList.add("ve-dragging");
        };
        card.ondragend = () => card.classList.remove("ve-dragging");
        card.ondragover = (e) => e.preventDefault();
        card.ondrop = (e) => {
          e.preventDefault();
          if (!dragEl || dragEl === card) return;
          const all = [...grid.querySelectorAll(".product-card")];
          const from = all.indexOf(dragEl);
          const to = all.indexOf(card);
          if (from < to) card.after(dragEl);
          else card.before(dragEl);
          saveGridOrder(grid);
        };
      });
    });
  }

  function saveGridOrder(grid) {
    const ids = [...grid.querySelectorAll(".product-card")]
      .map((c) => c.dataset.veProduct)
      .filter(Boolean);
    const d = CloverCMS.get();
    if (grid.id === "specialProducts") d.homepage.featuredSection.productIds = ids;
    d.shopListings.order = ids;
    CloverCMS.save(d);
    toast("Order saved");
  }

  /* ——— Media drawer ——— */
  function openMediaDrawer() {
    let drawer = $("#veMediaDrawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "veMediaDrawer";
      drawer.className = "ve-drawer";
      drawer.innerHTML = `<div class="ve-drawer__sheet">
        <h2 style="font-size:1.1rem;margin-bottom:0.5rem">Media Library</h2>
        <p style="font-size:0.85rem;color:#64748b;margin-bottom:1rem">Upload once, use anywhere on the site.</p>
        <label class="ve-btn ve-btn--primary" style="display:inline-block;cursor:pointer">Upload<input type="file" id="veMediaUpload" multiple accept="image/*,video/*" hidden /></label>
        <input type="search" id="veMediaSearch" placeholder="Search…" style="width:100%;margin:0.75rem 0;padding:0.5rem;border:1px solid #e2e8f0;border-radius:8px" />
        <div class="ve-media-grid" id="veMediaGrid"></div>
        <button type="button" class="ve-btn" style="margin-top:1rem" id="veMediaClose">Close</button>
      </div>`;
      document.body.appendChild(drawer);
      drawer.onclick = (e) => {
        if (e.target === drawer) drawer.classList.remove("is-open");
      };
      $("#veMediaClose").onclick = () => drawer.classList.remove("is-open");
      $("#veMediaUpload").onchange = async (e) => {
        for (const file of e.target.files) {
          await CloverMedia.upload(file, "Marketing Assets");
        }
        renderMediaGrid();
        toast("Uploaded");
      };
      $("#veMediaSearch").oninput = renderMediaGrid;
    }
    drawer.classList.add("is-open");
    renderMediaGrid();
  }

  async function renderMediaGrid() {
    const grid = $("#veMediaGrid");
    if (!grid) return;
    const q = ($("#veMediaSearch")?.value || "").toLowerCase();
    const list = CloverMedia.getMetaList().filter((m) => !q || m.name.toLowerCase().includes(q));
    grid.innerHTML = "";
    for (const m of list) {
      let src = m.url || "";
      if (!src && m.id) src = (await CloverMedia.getBlobUrl(m.id)) || "";
      if (!src) continue;
      const img = document.createElement("img");
      img.src = src;
      img.title = m.name;
      img.onclick = () => {
        navigator.clipboard?.writeText(src);
        toast("URL copied — paste into image field or use Replace on site");
      };
      grid.appendChild(img);
    }
    if (!list.length) grid.innerHTML = "<p>No media yet. Upload files above.</p>";
  }

  /* ——— Page-specific media bindings ——— */
  function bindPageMedia() {
    const page = document.body.dataset.page;

    if (page === "home") {
      const video = $(".veg-hero__video");
      if (video) {
        wrapMedia(video, "Hero video");
        video.closest(".ve-media-wrap").dataset.veCms = "homepage.hero";
      }
      const expertImg = $(".veg-expert__media img");
      if (expertImg) {
        wrapMedia(expertImg, "Expert image");
        expertImg.closest(".ve-media-wrap").dataset.veCms = "homepage.expert";
      }
    }

    $$(".product-card__img img").forEach((img) => wrapMedia(img, "Product"));
    $$(".pdp-gallery__main img, .pdp-gallery__thumb img").forEach((img) => wrapMedia(img, "Variant"));
  }

  function bindAll() {
    $$("[data-ve]").forEach(bindText);
    bindPageMedia();
    bindProductCards();
    bindSortable();
  }

  function init() {
    const params = new URLSearchParams(location.search);
    const session = CloverCMS.getSession();
    if (!session && !params.get("ve")) return;

    if (!session) {
      location.href = "admin.html?redirect=" + encodeURIComponent(location.pathname + location.search);
      return;
    }

    CloverVE.enableEdit();
    CloverVE.ensureDrafts();
    buildToolbar();
    document.body.classList.add("ve-editing");
    if (CloverVE.isPreview()) {
      document.body.classList.add("ve-preview");
      $("#vePreview").textContent = "Exit preview";
    }

    bindAll();

    window.addEventListener("catalog:draft", () => {
      refreshProductGrids();
      bindProductCards();
    });

    window.CloverVE = Object.assign(window.CloverVE || {}, {
      refresh: bindAll,
      openProductPanel,
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else setTimeout(init, 100);
})();
