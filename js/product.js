(function () {
  "use strict";

  const root = document.getElementById("pdpRoot");
  const toast = document.getElementById("toast");
  const params = new URLSearchParams(location.search);
  const productId = params.get("id");

  let product = null;
  let variantId = params.get("color") || null;
  let size = params.get("size") || "M";
  let imageIndex = 0;

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("is-visible");
    setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function currentVariant() {
    if (!product) return null;
    return product.variants.find((v) => v.id === variantId) || product.variants[0];
  }

  function currentImages() {
    const v = currentVariant();
    return v?.images?.length ? v.images : [];
  }

  function render() {
    product = CloverStore.getProduct(productId);
    if (!product) {
      root.innerHTML = `<p style="text-align:center;padding:3rem"><a href="shop.html">← Back to shop</a></p>`;
      return;
    }

    if (!variantId || !product.variants.some((v) => v.id === variantId)) {
      variantId = product.variants[0].id;
    }

    const v = currentVariant();
    const images = currentImages();
    if (imageIndex >= images.length) imageIndex = 0;

    const main = images[imageIndex] || images[0];
    const price = v.salePrice ?? v.price;
    const stock = v.stock?.[size] ?? 0;

    root.innerHTML = `
      <div class="pdp__grid">
        <div class="pdp-gallery">
          <div class="pdp-gallery__main" id="pdpMain">
            <img src="${main.src}" alt="${main.label || product.name}" id="pdpMainImg" loading="eager" />
          </div>
          <div class="pdp-gallery__thumbs" id="pdpThumbs">
            ${images
              .map(
                (img, i) => `
              <button type="button" class="pdp-gallery__thumb${i === imageIndex ? " is-active" : ""}" data-idx="${i}" aria-label="${img.label || "View image"}">
                <img src="${img.src}" alt="" loading="lazy" />
              </button>`
              )
              .join("")}
          </div>
        </div>
        <div class="pdp-info">
          <p class="pdp__breadcrumb"><a href="shop.html">Shop</a> / ${product.category}</p>
          <h1 class="pdp__title">${product.name}</h1>
          <p class="pdp__price">$${Number(price).toFixed(0)}</p>
          <p class="pdp__desc">${product.description}</p>

          <span class="pdp__label">Color — ${v.name}</span>
          <div class="pdp-colors" id="pdpColors">
            ${product.variants
              .map(
                (vr) => `
              <button type="button" class="pdp-color${vr.id === variantId ? " is-active" : ""}" data-variant="${vr.id}">
                <span class="pdp-color__swatch" style="background:${vr.hex}"></span>
                ${vr.name}
              </button>`
              )
              .join("")}
          </div>

          <span class="pdp__label">Size</span>
          <div class="pdp-sizes" id="pdpSizes">
            ${CloverStore.getSizes()
              .map((s) => {
                const q = v.stock?.[s] ?? 0;
                return `<button type="button" class="pdp-size${s === size ? " is-active" : ""}" data-size="${s}" ${q < 1 ? "disabled" : ""}>${s}</button>`;
              })
              .join("")}
          </div>

          <div class="pdp__actions">
            <button type="button" class="btn btn--dark btn--block" id="pdpAdd" ${stock < 1 ? "disabled" : ""}>Add to cart</button>
            <button type="button" class="btn btn--outline" id="pdpWish">${CloverWishlist.has(product.id, variantId) ? "♥ Saved" : "♡ Wishlist"}</button>
          </div>
          <p class="pdp__stock${stock > 0 && stock <= 5 ? " is-low" : ""}" id="pdpStock">${stock > 0 ? `${stock} in stock` : "Out of stock"}</p>
        </div>
      </div>
      <section style="margin-top:3rem" id="pdpRecent"></section>
    `;

    bindEvents();
    renderRecent();
    CloverRecent.track(product.id);
    history.replaceState(null, "", `product.html?id=${product.id}&color=${variantId}&size=${size}`);
  }

  function bindEvents() {
    document.getElementById("pdpColors")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-variant]");
      if (!btn) return;
      const nextId = btn.dataset.variant;
      if (nextId === variantId) return;
      variantId = nextId;
      imageIndex = 0;
      render();
    });

    document.getElementById("pdpSizes")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-size]");
      if (!btn || btn.disabled) return;
      size = btn.dataset.size;
      render();
    });

    document.getElementById("pdpThumbs")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-idx]");
      if (!btn) return;
      imageIndex = Number(btn.dataset.idx);
      render();
    });

    const main = document.getElementById("pdpMain");
    const mainImg = document.getElementById("pdpMainImg");
    main?.addEventListener("click", () => {
      main?.classList.toggle("is-zoomed");
    });

    mainImg?.addEventListener("dblclick", () => {
      const lb = document.getElementById("pdpLightbox");
      const lbImg = document.getElementById("pdpLightboxImg");
      if (lb && lbImg) {
        lbImg.src = mainImg.src;
        lb.hidden = false;
        lb.classList.add("is-open");
      }
    });

    document.getElementById("pdpLightboxClose")?.addEventListener("click", closeLightbox);
    document.getElementById("pdpLightbox")?.addEventListener("click", (e) => {
      if (e.target.id === "pdpLightbox") closeLightbox();
    });

    let touchX = 0;
    main?.addEventListener(
      "touchstart",
      (e) => {
        touchX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );
    main?.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].screenX - touchX;
        const imgs = currentImages();
        if (Math.abs(dx) < 40 || imgs.length < 2) return;
        if (dx < 0) imageIndex = (imageIndex + 1) % imgs.length;
        else imageIndex = (imageIndex - 1 + imgs.length) % imgs.length;
        render();
      },
      { passive: true }
    );

    document.getElementById("pdpAdd")?.addEventListener("click", () => {
      const line = CloverStore.lineItem(product.id, variantId, size, 1);
      if (line) {
        CloverCart.add(line, size, 1);
        showToast(`Added ${product.name} (${currentVariant().name}, ${size})`);
      }
    });

    document.getElementById("pdpWish")?.addEventListener("click", () => {
      const on = CloverWishlist.toggle(product.id, variantId);
      showToast(on ? "Added to wishlist" : "Removed from wishlist");
      render();
    });

    if (typeof CloverMedia !== "undefined") CloverMedia.hydrateImages(root);
  }

  function closeLightbox() {
    const lb = document.getElementById("pdpLightbox");
    lb?.classList.remove("is-open");
    if (lb) lb.hidden = true;
  }

  function renderRecent() {
    const el = document.getElementById("pdpRecent");
    if (!el) return;
    const items = CloverRecent.getProducts().filter((p) => p.id !== product.id);
    if (!items.length) return;
    el.innerHTML = `
      <h2 class="veg-section-title" style="font-size:1.35rem;margin-bottom:1rem">Recently viewed</h2>
      <div class="product-grid">
        ${items
          .slice(0, 4)
          .map((p) => {
            const img = CloverStore.cardImage(p);
            const price = CloverStore.cardPrice(p);
            return `
          <article class="product-card">
            <a class="product-card__link" href="product.html?id=${p.id}">
              <div class="product-card__img">
                <img src="${img}" alt="${p.name}" loading="lazy" />
              </div>
              <div class="product-card__body">
                <span class="product-card__cat">${p.category}</span>
                <h3 class="product-card__name">${p.name}</h3>
                <div class="product-card__row">
                  <span class="product-card__price">From $${price}</span>
                </div>
              </div>
            </a>
          </article>`;
          })
          .join("")}
      </div>`;
  }

  if (!productId) {
    location.href = "shop.html";
    return;
  }

  window.CloverPDP = { refresh: render };

  render();
})();
