(function () {
  "use strict";

  const grid = document.getElementById("shopGrid");
  const filters = document.getElementById("shopFilters");
  const searchInput = document.getElementById("shopSearch");
  const toast = document.getElementById("toast");
  const params = new URLSearchParams(location.search);
  let activeCat = params.get("cat") || "all";

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("is-visible");
    setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function renderCard(p) {
    const img = CloverStore.cardImage(p);
    const price = CloverStore.cardPrice(p);
    const colors = p.variants.length;
    const vid = p.variants[0]?.id || "";
    const wished = CloverWishlist.has(p.id, vid);

    return `
      <article class="product-card">
        <a class="product-card__link" href="product.html?id=${encodeURIComponent(p.id)}">
          <div class="product-card__img">
            <button type="button" class="product-card__wish" data-wish="${p.id}" data-variant="${vid}" aria-label="Wishlist">${wished ? "♥" : "♡"}</button>
            <img src="${img}" alt="${p.name}" loading="lazy" width="400" height="500" />
          </div>
          <div class="product-card__body">
            <span class="product-card__cat">${p.category.replace(/-/g, " ")}</span>
            <h3 class="product-card__name">${p.name}</h3>
            <p class="product-card__meta" style="font-size:0.8rem;color:var(--text-muted);margin:0.25rem 0">${colors} color${colors > 1 ? "s" : ""}</p>
            <div class="product-card__row">
              <span class="product-card__price">${colors > 1 ? "From " : ""}$${price}</span>
              <span class="product-card__view" style="font-size:0.8rem;font-weight:600;color:var(--accent-dark)">View →</span>
            </div>
          </div>
        </a>
      </article>`;
  }

  function render(products) {
    if (!grid) return;
    const list = products.filter((p) => inStockFilter(p));

    grid.innerHTML = list.length
      ? list.map(renderCard).join("")
      : '<p style="grid-column:1/-1;color:var(--text-muted);text-align:center;padding:3rem">No products match your filters.</p>';

    grid.querySelectorAll("[data-wish]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const on = CloverWishlist.toggle(btn.dataset.wish, btn.dataset.variant);
        showToast(on ? "Saved to wishlist" : "Removed from wishlist");
        refresh();
      });
    });

    if (typeof CloverMedia !== "undefined") CloverMedia.hydrateImages(grid);
    if (window.CloverVE?.refresh) window.CloverVE.refresh();
  }

  function inStockFilter(p) {
    const only = document.getElementById("filterInStock")?.checked;
    if (!only) return true;
    return p.variants.some((v) => CloverStore.variantStock(v) > 0);
  }

  function getShopProducts() {
    if (typeof CloverCMS !== "undefined") {
      let list = CloverCMS.getShopOrderedProducts();
      const q = (searchInput?.value || "").trim().toLowerCase();
      const cat = activeCat;
      const maxPrice = Number(document.getElementById("filterMaxPrice")?.value) || undefined;
      const inStockOnly = document.getElementById("filterInStock")?.checked;
      if (cat && cat !== "all") list = list.filter((p) => p.category === cat);
      if (q) {
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.tags.some((t) => t.includes(q))
        );
      }
      if (maxPrice) list = list.filter((p) => CloverStore.cardPrice(p) <= maxPrice);
      if (inStockOnly) list = list.filter((p) => p.variants.some((v) => CloverStore.variantStock(v) > 0));
      return list;
    }
    return CloverStore.filterProducts({
      category: activeCat,
      query: searchInput?.value || "",
      maxPrice: Number(document.getElementById("filterMaxPrice")?.value) || undefined,
      inStockOnly: document.getElementById("filterInStock")?.checked,
    });
  }

  function refresh() {
    render(getShopProducts());
  }

  function buildFilters() {
    if (!filters) return;
    const cats = CloverStore.getCategories();
    filters.innerHTML = cats
      .map(
        (c) =>
          `<button type="button" class="filter-pill${c.id === activeCat ? " is-active" : ""}" data-cat="${c.id}">${c.label}</button>`
      )
      .join("");

    filters.querySelectorAll(".filter-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        activeCat = pill.dataset.cat;
        filters.querySelectorAll(".filter-pill").forEach((p) => p.classList.toggle("is-active", p === pill));
        refresh();
      });
    });
  }

  if (params.get("q") && searchInput) {
    searchInput.value = params.get("q");
  }

  buildFilters();
  searchInput?.addEventListener("input", refresh);
  document.getElementById("filterMaxPrice")?.addEventListener("change", refresh);
  document.getElementById("filterInStock")?.addEventListener("change", refresh);

  window.__shopRefresh = refresh;
  refresh();
})();
