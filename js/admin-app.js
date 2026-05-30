(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const NAV = [
    { group: "Start here", items: [{ id: "dashboard", label: "Dashboard", icon: "🏠" }] },
    {
      group: "Your store",
      items: [
        { id: "products", label: "Products", icon: "👕", perm: "products" },
        { id: "homepage", label: "Homepage", icon: "✨", perm: "homepage" },
        { id: "shop", label: "Shop order", icon: "↕️", perm: "shop" },
        { id: "media", label: "Photos & videos", icon: "🖼️", perm: "media" },
        { id: "categories", label: "Categories", icon: "📁", perm: "categories" },
      ],
    },
    {
      group: "More",
      items: [
        { id: "orders", label: "Orders", icon: "📦", perm: "orders" },
        { id: "pages", label: "About & Contact", icon: "📄", perm: "about" },
        { id: "seo", label: "SEO", icon: "🔍", perm: "seo" },
        { id: "settings", label: "Settings", icon: "⚙️", perm: "view" },
      ],
    },
  ];

  const TITLES = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])));

  let editingProduct = null;
  let modalSave = null;
  const variantUploaders = new Map();
  const colUploaders = new Map();
  const homepageUploaders = {};

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  }

  function toast(msg) {
    const el = $("#admToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    setTimeout(() => el.classList.remove("is-visible"), 2800);
  }

  function can(perm) {
    return CloverCMS.can(perm);
  }

  function openModal(title, bodyHtml, footHtml, onSave) {
    $("#admModalTitle").textContent = title;
    $("#admModalBody").innerHTML = bodyHtml;
    $("#admModalFoot").innerHTML = footHtml || `<button type="button" class="adm-btn" data-close-modal>Cancel</button>`;
    modalSave = onSave;
    $("#admModal").hidden = false;
    $$("[data-close-modal]", $("#admModal")).forEach((b) =>
      b.addEventListener("click", closeModal)
    );
    const saveBtn = $("#admModalFoot .adm-btn--primary");
    if (saveBtn && onSave) {
      saveBtn.onclick = async () => {
        try {
          await onSave();
          closeModal();
        } catch (e) {
          toast(e.message || "Save failed");
        }
      };
    }
  }

  function closeModal() {
    $("#admModal").hidden = true;
    modalSave = null;
    editingProduct = null;
  }

  function statusPill(status) {
    const s = status || "active";
    return `<span class="adm-pill adm-pill--${s}">${s}</span>`;
  }

  /* ——— Login ——— */
  function renderLogin() {
    $("#loginScreen").innerHTML = `
      <div class="adm-login__card">
        <h1>THE CLOVER</h1>
        <p>Sign in to manage your store. Changes stay as a <strong>draft</strong> until you publish.</p>
        <form id="loginForm">
          <div class="adm-field"><label>Email</label><input type="email" id="loginEmail" value="admin@theclover.com" required autocomplete="username" /></div>
          <div class="adm-field"><label>Password</label><input type="password" id="loginPass" value="clover2026" required autocomplete="current-password" /></div>
          <button type="submit" class="adm-btn adm-btn--primary" style="width:100%;padding:0.75rem;margin-top:0.25rem">Sign in</button>
        </form>
        <p class="adm-help" style="text-align:center;margin-top:1rem">Demo · admin@theclover.com · clover2026</p>
      </div>`;
    $("#loginForm").onsubmit = (e) => {
      e.preventDefault();
      const session = CloverCMS.login($("#loginEmail").value.trim(), $("#loginPass").value);
      if (!session) {
        toast("Wrong email or password");
        return;
      }
      if (typeof CloverVE !== "undefined") CloverVE.ensureDrafts();
      bootApp();
    };
  }

  function buildNav() {
    const nav = $("#admNav");
    nav.innerHTML = NAV.map(
      (g) => `
      <div class="adm-nav__group">${g.group}</div>
      ${g.items
        .filter((i) => !i.perm || can(i.perm) || can("view"))
        .map(
          (i) =>
            `<a href="#${i.id}" class="adm-nav__link" data-panel="${i.id}">${i.icon || "•"} ${i.label}</a>`
        )
        .join("")}`
    ).join("");

    $$(".adm-nav__link", nav).forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        route(a.dataset.panel);
      };
    });
  }

  function route(id) {
    if (!TITLES[id]) id = "dashboard";
    $$(".adm-nav__link").forEach((a) => a.classList.toggle("is-active", a.dataset.panel === id));
    $("#admTitle").textContent = TITLES[id];
    $("#admCrumb").textContent = "Admin / " + TITLES[id];
    history.replaceState(null, "", `#${id}`);
    const renderers = {
      dashboard: renderDashboard,
      products: renderProducts,
      categories: renderCategories,
      collections: renderCollections,
      media: renderMedia,
      homepage: renderHomepage,
      shop: renderShop,
      orders: renderOrders,
      customers: renderCustomers,
      promotions: renderPromotions,
      analytics: renderAnalytics,
      settings: renderSettings,
      seo: renderSeo,
      "nav-footer": renderNavFooter,
      pages: renderPages,
      users: renderUsers,
      activity: renderActivity,
    };
    const fn = renderers[id] || renderDashboard;
    const result = fn();
    if (result && typeof result.then === "function") result.then(() => CloverMedia.hydrateImages($("#admContent")));
    else CloverMedia.hydrateImages($("#admContent"));
  }

  /* ——— Dashboard ——— */
  function renderDashboard() {
    const products = CloverStore.getProducts();
    const orders = CloverCMS.get().orders;
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    let low = 0;
    products.forEach((p) =>
      p.variants.forEach((v) => {
        const st = CloverStore.variantStock(v);
        if (st > 0 && st <= 5) low++;
      })
    );

    $("#admContent").innerHTML = `
      <div class="adm-quick">
        <a href="#products" class="adm-quick__card" data-goto="products">
          <div class="adm-quick__icon">👕</div>
          <strong>Manage products</strong>
          <span>Add, edit prices, colors & photos</span>
        </a>
        <a href="#homepage" class="adm-quick__card" data-goto="homepage">
          <div class="adm-quick__icon">✨</div>
          <strong>Edit homepage</strong>
          <span>Hero text, video & featured items</span>
        </a>
        <a href="index.html?ve=1" class="adm-quick__card" target="_blank">
          <div class="adm-quick__icon">🎨</div>
          <strong>Visual editor</strong>
          <span>Edit the real site — click & type</span>
        </a>
        <a href="#media" class="adm-quick__card" data-goto="media">
          <div class="adm-quick__icon">🖼️</div>
          <strong>Upload media</strong>
          <span>Photos and videos in one place</span>
        </a>
      </div>
      <div class="adm-grid adm-grid--4">
        <div class="adm-card"><span class="adm-stat__label">Products</span><div class="adm-stat__value">${products.length}</div></div>
        <div class="adm-card"><span class="adm-stat__label">Orders</span><div class="adm-stat__value">${orders.length}</div></div>
        <div class="adm-card"><span class="adm-stat__label">Sample revenue</span><div class="adm-stat__value">$${revenue.toLocaleString()}</div></div>
        <div class="adm-card"><span class="adm-stat__label">Low stock alerts</span><div class="adm-stat__value adm-stat__value--warn">${low}</div></div>
      </div>
      <div class="adm-card" style="margin-top:1rem">
        <h2>How it works</h2>
        <ol style="margin:0.75rem 0 0 1.25rem;color:var(--adm-muted);font-size:0.9rem;line-height:1.8">
          <li>Make changes here or use the <strong>visual editor</strong> on your live site.</li>
          <li>Customers won't see updates until you click <strong>Publish changes</strong> (top right).</li>
          <li>Use <strong>Preview live</strong> to check what's on the store now.</li>
        </ol>
      </div>`;

    $$("[data-goto]").forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        route(a.dataset.goto);
      };
    });
  }

  /* ——— Products ——— */
  function renderProducts() {
    const products = CloverStore.getProducts();

    $("#admContent").innerHTML = `
      <div class="adm-card">
        <div class="adm-card__head">
          <div>
            <h2>Products</h2>
            <p class="adm-help">Click <strong>Edit</strong> on any row. Each color has its own photos.</p>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            ${can("products") ? `<button type="button" class="adm-btn adm-btn--primary" id="btnAddProduct">+ Add product</button>` : ""}
            <button type="button" class="adm-btn adm-btn--sm" id="btnExportCat">Export backup</button>
            <button type="button" class="adm-btn adm-btn--sm" id="btnImportCat">Import backup</button>
          </div>
        </div>
        <div class="adm-table-wrap">
          <table class="adm-table">
            <thead><tr><th>Name</th><th>Category</th><th>Status</th><th>Variants</th><th>From</th><th></th></tr></thead>
            <tbody>
              ${products
                .map(
                  (p) => `
                <tr>
                  <td><strong>${esc(p.name)}</strong><br><small style="color:var(--adm-muted)">${esc(p.id)}</small></td>
                  <td>${esc(p.category)}</td>
                  <td>${statusPill(p.status)}</td>
                  <td>${p.variants.length}</td>
                  <td>$${CloverStore.cardPrice(p)}</td>
                  <td style="white-space:nowrap">
                    <button type="button" class="adm-btn adm-btn--sm" data-edit="${esc(p.id)}">Edit</button>
                    <button type="button" class="adm-btn adm-btn--sm" data-dup="${esc(p.id)}">Dup</button>
                    ${p.status === "archived" ? `<button type="button" class="adm-btn adm-btn--sm" data-restore="${esc(p.id)}">Restore</button>` : `<button type="button" class="adm-btn adm-btn--sm" data-archive="${esc(p.id)}">Archive</button>`}
                    <button type="button" class="adm-btn adm-btn--sm adm-btn--danger" data-del="${esc(p.id)}">Del</button>
                  </td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
      <input type="file" id="importFile" accept="application/json" hidden />`;

    $("#btnAddProduct")?.addEventListener("click", () => openProductEditor(null));
    $("#btnExportCat")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(CloverStore.getProducts(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "clover-catalog.json";
      a.click();
      toast("Catalog exported");
    });
    $("#btnImportCat")?.addEventListener("click", () => $("#importFile").click());
    $("#importFile").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const data = JSON.parse(await file.text());
      CloverStore.saveCatalog(data);
      CloverCMS.log("catalog_import", `${data.length} products`);
      toast("Catalog imported");
      renderProducts();
    };

    $$("[data-edit]").forEach((b) => b.onclick = () => openProductEditor(CloverStore.getProduct(b.dataset.edit)));
    $$("[data-dup]").forEach((b) => {
      b.onclick = () => {
        CloverStore.duplicateProduct(b.dataset.dup);
        CloverCMS.log("product_duplicate", b.dataset.dup);
        toast("Duplicated");
        renderProducts();
      };
    });
    $$("[data-archive]").forEach((b) => {
      b.onclick = () => {
        CloverStore.setProductStatus(b.dataset.archive, "archived");
        CloverCMS.log("product_archive", b.dataset.archive);
        renderProducts();
      };
    });
    $$("[data-restore]").forEach((b) => {
      b.onclick = () => {
        CloverStore.setProductStatus(b.dataset.restore, "active");
        renderProducts();
      };
    });
    $$("[data-del]").forEach((b) => {
      b.onclick = () => {
        if (confirm("Delete permanently?")) {
          CloverStore.removeProduct(b.dataset.del);
          CloverCMS.log("product_delete", b.dataset.del);
          renderProducts();
        }
      };
    });
  }

  function openProductEditor(product) {
    if (!can("products") && product) {
      toast("Permission denied");
      return;
    }
    editingProduct = product
      ? JSON.parse(JSON.stringify(product))
      : {
          id: "",
          name: "",
          description: "",
          category: "tops",
          tags: [],
          featured: false,
          status: "active",
          brand: "THE CLOVER",
          sku: "",
          variants: [
            {
              id: "black",
              name: "Black",
              hex: "#1a1a1a",
              price: 0,
              salePrice: null,
              images: [],
              videos: [],
              stock: { XS: 0, S: 0, M: 0, L: 0, XL: 0 },
            },
          ],
        };

    const cats = CloverCMS.getCategories()
      .filter((c) => c.id !== "all")
      .map((c) => `<option value="${esc(c.id)}" ${editingProduct.category === c.id ? "selected" : ""}>${esc(c.label)}</option>`)
      .join("");

    const variantsHtml = editingProduct.variants
      .map(
        (v, vi) => `
      <div class="adm-variant-block" data-vi="${vi}">
        <div class="adm-field--row">
          <div class="adm-field"><label>Color name</label><input data-v="name" value="${esc(v.name)}" /></div>
          <div class="adm-field"><label>Variant ID</label><input data-v="id" value="${esc(v.id)}" /></div>
        </div>
        <div class="adm-field--row">
          <div class="adm-field"><label>Price</label><input type="number" step="0.01" data-v="price" value="${v.price ?? 0}" /></div>
          <div class="adm-field"><label>Sale price</label><input type="number" step="0.01" data-v="salePrice" value="${v.salePrice ?? ""}" placeholder="Optional" /></div>
        </div>
        <div class="adm-field"><label>Hex</label><input type="color" data-v="hex" value="${v.hex || "#000000"}" /></div>
        ${AdminUpload.galleryHtml("Photos for this color", "Upload then crop. Use ✂ on a photo to re-crop.")}
        <div class="adm-field"><label>Stock (XS–XL comma)</label><input data-v="stock" value="${["XS", "S", "M", "L", "XL"].map((s) => v.stock?.[s] ?? 0).join(",")}" /></div>
        ${vi > 0 ? `<button type="button" class="adm-btn adm-btn--sm adm-btn--danger" data-remove-variant="${vi}">Remove variant</button>` : ""}
      </div>`
      )
      .join("");

    openModal(
      product ? "Edit product" : "Add product",
      `
      <div class="adm-tabs"><button type="button" class="adm-tab is-active">General</button></div>
      <div class="adm-field"><label>Product name</label><input id="peName" value="${esc(editingProduct.name)}" /></div>
      <div class="adm-field"><label>Product ID (slug)</label><input id="peId" value="${esc(editingProduct.id)}" ${product ? "readonly" : ""} /></div>
      <div class="adm-field"><label>Description</label><textarea id="peDesc">${esc(editingProduct.description)}</textarea></div>
      <div class="adm-field--row">
        <div class="adm-field"><label>Category</label><select id="peCat">${cats}</select></div>
        <div class="adm-field"><label>Status</label><select id="peStatus">
          <option value="active" ${editingProduct.status === "active" ? "selected" : ""}>Active</option>
          <option value="draft" ${editingProduct.status === "draft" ? "selected" : ""}>Draft</option>
          <option value="archived" ${editingProduct.status === "archived" ? "selected" : ""}>Archived</option>
        </select></div>
      </div>
      <div class="adm-field--row">
        <div class="adm-field"><label>Brand</label><input id="peBrand" value="${esc(editingProduct.brand || "THE CLOVER")}" /></div>
        <div class="adm-field"><label>SKU</label><input id="peSku" value="${esc(editingProduct.sku || "")}" /></div>
      </div>
      <div class="adm-field"><label>Tags (comma)</label><input id="peTags" value="${(editingProduct.tags || []).join(", ")}" /></div>
      <div class="adm-field"><label><input type="checkbox" id="peFeatured" ${editingProduct.featured ? "checked" : ""} /> Featured product</label></div>
      <h3 style="margin:1rem 0 0.5rem">Color variants</h3>
      <div id="peVariants">${variantsHtml}</div>
      <button type="button" class="adm-btn adm-btn--sm" id="peAddVariant">+ Add color</button>
      `,
      `<button type="button" class="adm-btn" data-close-modal>Cancel</button>
       <button type="button" class="adm-btn adm-btn--primary" id="peSave">Save product</button>`,
      saveProductEditor
    );

    $("#peAddVariant")?.addEventListener("click", () => {
      editingProduct.variants.push({
        id: `color-${Date.now()}`,
        name: "New Color",
        hex: "#888888",
        price: editingProduct.variants[0]?.price || 0,
        salePrice: null,
        images: [],
        videos: [],
        stock: { XS: 0, S: 0, M: 0, L: 0, XL: 0 },
      });
      closeModal();
      openProductEditor(editingProduct);
    });

    $$("[data-remove-variant]").forEach((b) => {
      b.onclick = () => {
        editingProduct.variants.splice(Number(b.dataset.removeVariant), 1);
        closeModal();
        openProductEditor(editingProduct);
      };
    });

    bindProductVariantUploads();
  }

  async function bindProductVariantUploads() {
    variantUploaders.clear();
    const blocks = $$(".adm-variant-block", $("#admModalBody"));
    for (const block of blocks) {
      const vi = Number(block.dataset.vi);
      const root = block.querySelector("[data-upload-root]");
      if (!root) continue;
      const images = (editingProduct.variants[vi]?.images || []).filter(
        (i) => i?.src && !CloverMedia.isBadPath(i.src)
      );
      const api = await AdminUpload.renderGallery(root, images, {
        folder: "Product Images",
        aspect: "4:5",
      });
      variantUploaders.set(vi, api);
    }
  }

  function collectVariantsFromModal() {
    return $$(".adm-variant-block", $("#admModalBody")).map((block) => {
      const vi = block.dataset.vi;
      const get = (attr) => $(`[data-v="${attr}"]`, block)?.value;
      const stockParts = get("stock").split(",").map((n) => parseInt(n.trim(), 10) || 0);
      const sizes = ["XS", "S", "M", "L", "XL"];
      const stock = {};
      sizes.forEach((s, i) => (stock[s] = stockParts[i] ?? 0));
      const api = variantUploaders.get(Number(vi));
      const images = api
        ? api.getImages()
        : [];
      const videos = [];
      return {
        id: get("id") || CloverStore.slugify(get("name")),
        name: get("name"),
        hex: get("hex"),
        price: parseFloat(get("price")) || 0,
        salePrice: get("salePrice") ? parseFloat(get("salePrice")) : null,
        images,
        videos,
        stock,
      };
    });
  }

  function saveProductEditor() {
    const p = {
      ...editingProduct,
      name: $("#peName").value.trim(),
      id: $("#peId").value.trim() || CloverStore.slugify($("#peName").value),
      description: $("#peDesc").value.trim(),
      category: $("#peCat").value,
      status: $("#peStatus").value,
      brand: $("#peBrand").value.trim(),
      sku: $("#peSku").value.trim(),
      tags: $("#peTags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      featured: $("#peFeatured").checked,
      variants: collectVariantsFromModal(),
    };
    if (!p.name) throw new Error("Name required");
    if (!p.variants.length) throw new Error("Add at least one color variant");

    if (CloverStore.getProduct(p.id) && p.id !== editingProduct.id) throw new Error("ID already exists");

    if (editingProduct.id && CloverStore.getProduct(editingProduct.id)) {
      CloverStore.saveProduct(p);
      CloverCMS.log("product_update", p.id);
    } else {
      CloverStore.addProduct(p);
      CloverCMS.log("product_create", p.id);
    }
    toast("Product saved");
    renderProducts();
  }

  /* ——— Categories ——— */
  function renderCategories() {
    const cats = [...CloverCMS.getCategories()];
    $("#admContent").innerHTML = `
      <div class="adm-card">
        <div class="adm-card__head"><h2>Categories</h2><button type="button" class="adm-btn adm-btn--primary" id="addCat">+ Add</button></div>
        <div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>ID</th><th>Label</th><th></th></tr></thead>
        <tbody>${cats.map((c, i) => `<tr><td>${esc(c.id)}</td><td><input data-ci="${i}" data-f="label" value="${esc(c.label)}" style="background:transparent;border:1px solid var(--adm-border);padding:0.35rem;border-radius:6px;width:100%" /></td>
        <td>${c.id !== "all" ? `<button type="button" class="adm-btn adm-btn--sm adm-btn--danger" data-rm-cat="${i}">Remove</button>` : ""}</td></tr>`).join("")}
        </tbody></table></div>
        <button type="button" class="adm-btn adm-btn--primary" style="margin-top:1rem" id="saveCats">Save categories</button>
      </div>`;

    $("#addCat").onclick = () => {
      cats.push({ id: `cat-${Date.now()}`, label: "New Category" });
      CloverCMS.saveCategories(cats);
      renderCategories();
    };
    $("#saveCats").onclick = () => {
      const updated = cats.map((c, i) => {
        const inp = $(`[data-ci="${i}"][data-f="label"]`);
        return { ...c, label: inp?.value || c.label };
      });
      CloverCMS.saveCategories(updated);
      toast("Categories saved");
    };
    $$("[data-rm-cat]").forEach((b) => {
      b.onclick = () => {
        cats.splice(Number(b.dataset.rmCat), 1);
        CloverCMS.saveCategories(cats);
        renderCategories();
      };
    });
  }

  /* ——— Collections ——— */
  async function renderCollections() {
    const cols = CloverCMS.get().collections;
    $("#admContent").innerHTML = `
      <div class="adm-card">
        <div class="adm-card__head"><h2>Collections</h2><button type="button" class="adm-btn adm-btn--primary" id="addCol">+ Collection</button></div>
        ${cols
          .map(
            (c, i) => `
          <div class="adm-variant-block" data-col-block="${i}">
            <div class="adm-field"><label>Name</label><input data-col="${i}" data-f="name" value="${esc(c.name)}" /></div>
            <div class="adm-field"><label>Description</label><input data-col="${i}" data-f="description" value="${esc(c.description)}" /></div>
            <div class="adm-field"><label>Product IDs (comma)</label><input data-col="${i}" data-f="productIds" value="${(c.productIds || []).join(", ")}" /></div>
            ${AdminUpload.singleHtml("Collection cover", "Upload a cover image — do not paste file paths.")}
          </div>`
          )
          .join("")}
        <button type="button" class="adm-btn adm-btn--primary" id="saveCols">Save collections</button>
      </div>`;

    colUploaders.clear();
    for (let i = 0; i < cols.length; i++) {
      const holder = $(`[data-col-block="${i}"] [data-single-upload]`);
      colUploaders.set(
        i,
        await AdminUpload.bindSingle(holder, cols[i].image, { folder: "Collections" })
      );
    }

    $("#addCol").onclick = () => {
      const d = CloverCMS.get();
      d.collections.push({ id: `col-${Date.now()}`, name: "New Collection", slug: "", description: "", productIds: [], image: "" });
      CloverCMS.save(d);
      renderCollections();
    };
    $("#saveCols").onclick = () => {
      const d = CloverCMS.get();
      d.collections = cols.map((c, i) => ({
        ...c,
        name: $(`[data-col="${i}"][data-f="name"]`).value,
        description: $(`[data-col="${i}"][data-f="description"]`).value,
        productIds: $(`[data-col="${i}"][data-f="productIds"]`)
          .value.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        image: colUploaders.get(i)?.getSrc() || "",
      }));
      CloverCMS.save(d);
      CloverCMS.log("collections_save", `${d.collections.length} collections`);
      toast("Collections saved");
    };
  }

  /* ——— Media ——— */
  async function renderMedia() {
    const meta = CloverMedia.getMetaList();
    const folder = $("#mediaFolderFilter")?.value || "all";

    $("#admContent").innerHTML = `
      <div class="adm-card">
        <div class="adm-card__head">
          <h2>Media Library</h2>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <select id="mediaFolderFilter" class="adm-btn" style="padding:0.5rem">
              <option value="all">All folders</option>
              ${CloverCMS.MEDIA_FOLDERS.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join("")}
            </select>
            <select id="uploadFolder" class="adm-btn" style="padding:0.5rem">
              ${CloverCMS.MEDIA_FOLDERS.map((f) => `<option>${esc(f)}</option>`).join("")}
            </select>
            <label class="adm-btn adm-btn--primary" style="cursor:pointer">Upload<input type="file" id="mediaUpload" multiple accept="image/*,video/*" hidden /></label>
            <button type="button" class="adm-btn" id="mediaUrlAdd">+ URL</button>
          </div>
        </div>
        <div class="adm-media-grid" id="mediaGrid"><p style="color:var(--adm-muted)">Loading…</p></div>
      </div>`;

    $("#mediaFolderFilter").onchange = () => renderMedia();
    $("#mediaUpload").onchange = async (e) => {
      const folder = $("#uploadFolder").value;
      for (const file of e.target.files) {
        try {
          await CloverMedia.upload(file, folder);
        } catch (err) {
          toast(err.message);
        }
      }
      toast("Upload complete");
      renderMedia();
    };
    $("#mediaUrlAdd").onclick = () => {
      const url = prompt("Media URL (assets/... or https://)");
      if (!url) return;
      const kind = url.match(/\.(mp4|webm|mov)/i) ? "video" : "image";
      CloverMedia.addExternalUrl(url, $("#uploadFolder").value, null, kind);
      toast("URL added");
      renderMedia();
    };

    const grid = $("#mediaGrid");
    const filtered = folder === "all" ? meta : meta.filter((m) => m.folder === folder);
    if (!filtered.length) {
      grid.innerHTML = "<p>No media yet. Upload images or videos.</p>";
      return;
    }

    grid.innerHTML = "";
    for (const m of filtered) {
      const card = document.createElement("div");
      card.className = "adm-media-card";
      let src = m.url || "";
      if (!src && !m.external) {
        src = (await CloverMedia.getBlobUrl(m.id)) || "";
      }
      card.innerHTML = `
        ${m.kind === "video" ? `<video src="${esc(src)}" muted></video>` : `<img src="${esc(src)}" alt="" />`}
        <div class="adm-media-card__meta">
          <div>${esc(m.name)}</div>
          <div style="color:var(--adm-muted)">${esc(m.folder)}</div>
          <button type="button" class="adm-btn adm-btn--sm adm-btn--danger" style="margin-top:0.35rem" data-rm="${esc(m.id)}">Delete</button>
        </div>`;
      grid.appendChild(card);
    }
    $$("[data-rm]", grid).forEach((b) => {
      b.onclick = async () => {
        await CloverMedia.remove(b.dataset.rm);
        renderMedia();
      };
    });
  }

  /* ——— Homepage ——— */
  async function renderHomepage() {
    const hp = CloverCMS.get().homepage;
    const h = hp.hero;
    const products = CloverStore.storefrontProducts();

    $("#admContent").innerHTML = `
      <div class="adm-grid adm-grid--2">
        <div class="adm-card">
          <h2>Hero banner</h2>
          <p class="adm-help">Main headline visitors see first.</p>
          <div class="adm-field"><label>Headline</label><textarea id="hpTitle" rows="3">${esc(h.title)}</textarea><p class="adm-help">Tip: use &lt;em&gt;text&lt;/em&gt; for italic words</p></div>
          <div class="adm-field"><label>Short description</label><textarea id="hpSub" rows="2">${esc(h.subtitle)}</textarea></div>
          <div class="adm-field--row">
            <div class="adm-field"><label>CTA label</label><input id="hpCtaL" value="${esc(h.ctaLabel)}" /></div>
            <div class="adm-field"><label>CTA link</label><input id="hpCtaH" value="${esc(h.ctaHref)}" /></div>
          </div>
          <div class="adm-field"><label>Hero video file path</label><input id="hpVideo" value="${esc(h.videoSrc)}" placeholder="assets/hero-video.mp4" /><p class="adm-help">Upload in Photos & videos, then paste path here</p></div>
          <div id="hpHeroImgSlot">${AdminUpload.singleHtml("Backup hero image", "Shown when the hero video is off.")}</div>
          <div class="adm-field"><label><input type="checkbox" id="hpVidOn" ${h.videoEnabled !== false ? "checked" : ""} /> Video background enabled</label></div>
          <div class="adm-field--row">
            <div class="adm-field"><label><input type="checkbox" id="hpAuto" ${h.videoAutoplay !== false ? "checked" : ""} /> Autoplay</label></div>
            <div class="adm-field"><label><input type="checkbox" id="hpMute" ${h.videoMuted !== false ? "checked" : ""} /> Muted</label></div>
            <div class="adm-field"><label><input type="checkbox" id="hpLoop" ${h.videoLoop !== false ? "checked" : ""} /> Loop</label></div>
          </div>
          <div class="adm-field--row">
            <div class="adm-field"><label>Tag 1</label><input id="hpT1" value="${esc(h.tag1)}" /></div>
            <div class="adm-field"><label>Tag 2</label><input id="hpT2" value="${esc(h.tag2)}" /></div>
          </div>
        </div>
        <div class="adm-card">
          <h2>Featured products</h2>
          <p class="adm-help">Product IDs to show on homepage, in order. Or drag products on Shop order.</p>
          <div class="adm-field"><textarea id="hpFeat" rows="4" placeholder="ribbed-zip-jacket, front-zip-sports-bra">${(hp.featuredSection.productIds || []).join(", ")}</textarea></div>
          <p class="adm-help">IDs: ${products.map((p) => p.id).slice(0, 6).join(", ")}…</p>
          <div id="hpExpertImgSlot">${AdminUpload.singleHtml("Expert section photo", "Upload a photo for the “Designed by athletes” block.")}</div>
        </div>
      </div>
      <button type="button" class="adm-btn adm-btn--primary" style="margin-top:1rem" id="saveHp">Save homepage</button>`;

    homepageUploaders.hero = await AdminUpload.bindSingle(
      $("#hpHeroImgSlot [data-single-upload]"),
      h.imageSrc,
      { folder: "Hero Images" }
    );
    homepageUploaders.expert = await AdminUpload.bindSingle(
      $("#hpExpertImgSlot [data-single-upload]"),
      hp.expert.imageSrc,
      { folder: "Hero Images" }
    );

    $("#saveHp").onclick = () => {
      const d = CloverCMS.get();
      d.homepage.hero = {
        ...d.homepage.hero,
        title: $("#hpTitle").value,
        subtitle: $("#hpSub").value,
        ctaLabel: $("#hpCtaL").value,
        ctaHref: $("#hpCtaH").value,
        videoSrc: $("#hpVideo").value,
        imageSrc: homepageUploaders.hero?.getSrc() || d.homepage.hero.imageSrc,
        videoEnabled: $("#hpVidOn").checked,
        videoAutoplay: $("#hpAuto").checked,
        videoMuted: $("#hpMute").checked,
        videoLoop: $("#hpLoop").checked,
        tag1: $("#hpT1").value,
        tag2: $("#hpT2").value,
      };
      d.homepage.featuredSection.productIds = $("#hpFeat")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      d.homepage.expert.imageSrc = homepageUploaders.expert?.getSrc() || d.homepage.expert.imageSrc;
      CloverCMS.save(d);
      CloverCMS.log("homepage_save", "Hero & featured updated");
      toast("Homepage saved — refresh storefront");
    };
  }

  /* ——— Shop listings ——— */
  function renderShop() {
    CloverCMS.syncShopOrderFromCatalog();
    const cms = CloverCMS.get();
    const order = cms.shopListings.order || [];
    const hidden = new Set(cms.shopListings.hidden || []);
    const products = order.map((id) => CloverStore.getProduct(id)).filter(Boolean);

    $("#admContent").innerHTML = `
      <div class="adm-card">
        <div class="adm-card__head"><h2>Shop order & visibility</h2><p style="font-size:0.85rem;color:var(--adm-muted)">Drag to reorder</p></div>
        <ul class="adm-sort-list" id="shopSort">${products
          .map(
            (p) => `
          <li class="adm-sort-item" draggable="true" data-id="${esc(p.id)}">
            <span class="adm-sort-item__handle">⋮⋮</span>
            <span style="flex:1">${esc(p.name)}</span>
            <label style="font-size:0.8rem"><input type="checkbox" data-hide="${esc(p.id)}" ${hidden.has(p.id) ? "checked" : ""} /> Hidden</label>
            <label style="font-size:0.8rem"><input type="checkbox" data-feat="${esc(p.id)}" ${p.featured ? "checked" : ""} /> Featured</label>
          </li>`
          )
          .join("")}</ul>
        <button type="button" class="adm-btn adm-btn--primary" id="saveShop">Save shop listings</button>
      </div>`;

    const list = $("#shopSort");
    let dragId = null;
    $$(".adm-sort-item", list).forEach((item) => {
      item.ondragstart = () => {
        dragId = item.dataset.id;
        item.classList.add("is-dragging");
      };
      item.ondragend = () => item.classList.remove("is-dragging");
      item.ondragover = (e) => e.preventDefault();
      item.ondrop = (e) => {
        e.preventDefault();
        const target = item.dataset.id;
        if (!dragId || dragId === target) return;
        const ids = products.map((p) => p.id);
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(target);
        ids.splice(from, 1);
        ids.splice(to, 0, dragId);
        const d = CloverCMS.get();
        d.shopListings.order = ids;
        CloverCMS.save(d);
        renderShop();
      };
    });

    $("#saveShop").onclick = () => {
      const d = CloverCMS.get();
      d.shopListings.hidden = $$("[data-hide]:checked").map((c) => c.dataset.hide);
      $$("[data-feat]").forEach((c) => {
        const p = CloverStore.getProduct(c.dataset.feat);
        if (p) CloverStore.updateProduct(p.id, { featured: c.checked });
      });
      CloverCMS.save(d);
      CloverCMS.log("shop_listings_save", "Order & visibility");
      toast("Shop listings saved");
    };
  }

  /* ——— Orders / Customers / Promotions ——— */
  function renderOrders() {
    const orders = CloverCMS.get().orders;
    $("#admContent").innerHTML = `
      <div class="adm-card adm-table-wrap">
        <table class="adm-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${orders.map((o) => `<tr><td>${esc(o.id)}</td><td>${esc(o.customerName)}</td><td>${o.items}</td><td>$${o.total}</td><td>${esc(o.status)}</td></tr>`).join("")}
        </tbody></table>
      </div>`;
  }

  function renderCustomers() {
    const customers = CloverCMS.get().customers;
    $("#admContent").innerHTML = `
      <div class="adm-card adm-table-wrap">
        <table class="adm-table"><thead><tr><th>Name</th><th>Email</th><th>Orders</th><th>Spent</th></tr></thead>
        <tbody>${customers.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${c.orders}</td><td>$${c.spent}</td></tr>`).join("")}
        </tbody></table>
      </div>`;
  }

  function renderPromotions() {
    const promos = CloverCMS.get().promotions;
    $("#admContent").innerHTML = `
      <div class="adm-card">
        <div class="adm-card__head"><h2>Promotions & coupons</h2><button type="button" class="adm-btn adm-btn--primary" id="addPromo">+ Add</button></div>
        ${!promos.length ? "<p>No promotions yet.</p>" : promos.map((p) => `<div class="adm-variant-block"><strong>${esc(p.code)}</strong> — ${p.discount}% off</div>`).join("")}
      </div>`;
    $("#addPromo")?.addEventListener("click", () => {
      const code = prompt("Coupon code");
      const discount = prompt("Discount %", "10");
      if (!code) return;
      const d = CloverCMS.get();
      d.promotions.push({ id: `promo-${Date.now()}`, code, discount: Number(discount) || 10, active: true });
      CloverCMS.save(d);
      renderPromotions();
    });
  }

  function renderAnalytics() {
    const orders = CloverCMS.get().orders;
    const products = CloverStore.getProducts();
    $("#admContent").innerHTML = `
      <div class="adm-grid adm-grid--4">
        <div class="adm-card"><span class="adm-stat__label">Conversion (demo)</span><div class="adm-stat__value">3.2%</div></div>
        <div class="adm-card"><span class="adm-stat__label">Avg order</span><div class="adm-stat__value">$${Math.round(orders.reduce((s, o) => s + o.total, 0) / orders.length)}</div></div>
        <div class="adm-card"><span class="adm-stat__label">Products</span><div class="adm-stat__value">${products.length}</div></div>
        <div class="adm-card"><span class="adm-stat__label">Customers</span><div class="adm-stat__value">${CloverCMS.get().customers.length}</div></div>
      </div>`;
  }

  function renderSettings() {
    const s = CloverCMS.get().store;
    $("#admContent").innerHTML = `
      <div class="adm-card">
        <h2>Store settings</h2>
        <div class="adm-field"><label>Store name</label><input id="stName" value="${esc(s.name)}" /></div>
        <div class="adm-field"><label>Support email</label><input id="stEmail" value="${esc(s.email)}" /></div>
        <div class="adm-field"><label>Currency</label><input id="stCur" value="${esc(s.currency)}" /></div>
        <button type="button" class="adm-btn adm-btn--danger adm-btn--sm" id="resetCat">Reset catalog to defaults</button>
        <button type="button" class="adm-btn adm-btn--primary" style="margin-left:0.5rem" id="saveSt">Save</button>
      </div>`;
    $("#saveSt").onclick = () => {
      const d = CloverCMS.get();
      d.store = { name: $("#stName").value, email: $("#stEmail").value, currency: $("#stCur").value, currencySymbol: "$" };
      CloverCMS.save(d);
      toast("Settings saved");
    };
    $("#resetCat").onclick = () => {
      if (confirm("Reset entire product catalog?")) {
        CloverStore.reset();
        toast("Catalog reset");
      }
    };
  }

  async function renderSeo() {
    const seo = CloverCMS.get().seo;
    $("#admContent").innerHTML = `
      <div class="adm-card">
        <h2>SEO</h2>
        <div class="adm-field"><label>Site title</label><input id="seoTitle" value="${esc(seo.siteTitle)}" /></div>
        <div class="adm-field"><label>Meta description</label><textarea id="seoDesc">${esc(seo.metaDescription)}</textarea></div>
        <div id="seoOgSlot">${AdminUpload.singleHtml("Social share image (OG)", "Upload the image shown when your site is shared on social media.")}</div>
        <button type="button" class="adm-btn adm-btn--primary" id="saveSeo">Save SEO</button>
      </div>`;

    const ogUpload = await AdminUpload.bindSingle(
      $("#seoOgSlot [data-single-upload]"),
      seo.ogImage,
      { folder: "Marketing Assets" }
    );

    $("#saveSeo").onclick = () => {
      const d = CloverCMS.get();
      d.seo = {
        ...d.seo,
        siteTitle: $("#seoTitle").value,
        metaDescription: $("#seoDesc").value,
        ogImage: ogUpload.getSrc() || d.seo.ogImage,
      };
      CloverCMS.save(d);
      toast("SEO saved");
    };
  }

  function renderNavFooter() {
    const d = CloverCMS.get();
    $("#admContent").innerHTML = `
      <div class="adm-grid adm-grid--2">
        <div class="adm-card"><h2>Navigation</h2>
          ${d.nav.map((n, i) => `<div class="adm-field--row" style="margin-bottom:0.5rem">
            <input data-nav="${i}" data-f="label" value="${esc(n.label)}" placeholder="Label" />
            <input data-nav="${i}" data-f="href" value="${esc(n.href)}" placeholder="Link" />
          </div>`).join("")}
        </div>
        <div class="adm-card"><h2>Footer copyright</h2>
          <div class="adm-field"><textarea id="ftCopy">${esc(d.footer.copyright)}</textarea></div>
          <div class="adm-field"><label>Address</label><textarea id="ftAddr">${esc(d.footer.address)}</textarea></div>
        </div>
      </div>
      <button type="button" class="adm-btn adm-btn--primary" style="margin-top:1rem" id="saveNav">Save</button>`;
    $("#saveNav").onclick = () => {
      const data = CloverCMS.get();
      data.nav = data.nav.map((n, i) => ({
        ...n,
        label: $(`[data-nav="${i}"][data-f="label"]`).value,
        href: $(`[data-nav="${i}"][data-f="href"]`).value,
      }));
      data.footer.copyright = $("#ftCopy").value;
      data.footer.address = $("#ftAddr").value;
      CloverCMS.save(data);
      toast("Nav & footer saved");
    };
  }

  async function renderPages() {
    const about = CloverCMS.get().about;
    const contact = CloverCMS.get().contact;
    $("#admContent").innerHTML = `
      <div class="adm-grid adm-grid--2">
        <div class="adm-card"><h2>About page</h2>
          <div class="adm-field"><label>Title</label><input id="abTitle" value="${esc(about.title)}" /></div>
          <div class="adm-field"><label>Body</label><textarea id="abBody">${esc(about.body)}</textarea></div>
          <div id="abImgSlot">${AdminUpload.singleHtml("About page photo", "Upload the main about image.")}</div>
        </div>
        <div class="adm-card"><h2>Contact page</h2>
          <div class="adm-field"><label>Email</label><input id="ctEmail" value="${esc(contact.email)}" /></div>
          <div class="adm-field"><label>Phone</label><input id="ctPhone" value="${esc(contact.phone)}" /></div>
          <div class="adm-field"><label>Hours</label><input id="ctHours" value="${esc(contact.hours)}" /></div>
          <div class="adm-field"><label>Address</label><input id="ctAddr" value="${esc(contact.address)}" /></div>
        </div>
      </div>
      <button type="button" class="adm-btn adm-btn--primary" style="margin-top:1rem" id="savePages">Save pages</button>`;

    const aboutImg = await AdminUpload.bindSingle(
      $("#abImgSlot [data-single-upload]"),
      about.imageSrc,
      { folder: "Marketing Assets" }
    );

    $("#savePages").onclick = () => {
      const d = CloverCMS.get();
      d.about = {
        ...d.about,
        title: $("#abTitle").value,
        body: $("#abBody").value,
        imageSrc: aboutImg.getSrc() || d.about.imageSrc,
      };
      d.contact = { ...d.contact, email: $("#ctEmail").value, phone: $("#ctPhone").value, hours: $("#ctHours").value, address: $("#ctAddr").value };
      CloverCMS.save(d);
      toast("Pages saved — live on the store now");
    };
  }

  function renderUsers() {
    const users = CloverCMS.get().users;
    const session = CloverCMS.getSession();
    $("#admContent").innerHTML = `
      <div class="adm-card">
        <h2>Users & roles</h2>
        <p style="margin:0.75rem 0;color:var(--adm-muted)">Signed in as <strong>${esc(session?.email)}</strong> (${esc(session?.role)})</p>
        <table class="adm-table"><thead><tr><th>Email</th><th>Name</th><th>Role</th></tr></thead>
        <tbody>${users.map((u) => `<tr><td>${esc(u.email)}</td><td>${esc(u.name)}</td><td>${esc(u.role)}</td></tr>`).join("")}
        </tbody></table>
        <p style="margin-top:1rem;font-size:0.8rem;color:var(--adm-muted)">Roles: super_admin (full), admin (commerce), content_manager (CMS), staff (view)</p>
      </div>`;
  }

  function renderActivity() {
    const logs = CloverCMS.get().activity.slice(0, 50);
    $("#admContent").innerHTML = `
      <div class="adm-card adm-table-wrap">
        <table class="adm-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
        <tbody>${logs.map((l) => `<tr><td>${new Date(l.at).toLocaleString()}</td><td>${esc(l.user)}</td><td>${esc(l.action)}</td><td>${esc(l.detail)}</td></tr>`).join("")}
        </tbody></table>
      </div>`;
  }

  function bootApp() {
    $("#loginScreen").hidden = true;
    $("#adminShell").hidden = false;
    if (typeof CloverVE !== "undefined") CloverVE.ensureDrafts();

    buildNav();

    $("#btnLogout").onclick = () => {
      CloverCMS.logout();
      if (typeof CloverVE !== "undefined") CloverVE.disableEdit();
      location.reload();
    };

    $("#btnPublish")?.addEventListener("click", () => {
      if (confirm("Publish all your changes to the live store?")) {
        const done = () => toast("Published! Your store is now updated.");
        if (typeof CloverVE !== "undefined") {
          Promise.resolve(CloverVE.publish()).then(done);
        } else {
          done();
        }
      }
    });

    $("#btnPreview")?.addEventListener("click", () => {
      if (typeof CloverVE !== "undefined") {
        CloverVE.setPreview(true);
        window.open("index.html", "_blank");
        toast("Opened live preview in new tab");
      } else {
        window.open("index.html", "_blank");
      }
    });

    const hash = (location.hash || "#dashboard").slice(1);
    route(TITLES[hash] ? hash : "dashboard");
  }

  function init() {
    if (CloverCMS.getSession()) {
      bootApp();
    } else {
      renderLogin();
    }
  }

  init();
})();
