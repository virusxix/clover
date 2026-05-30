(function () {
  "use strict";

  const grid = document.getElementById("specialProducts");
  const toast = document.getElementById("toast");

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("is-visible");
    setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function renderCard(p) {
    const img = CloverStore.cardImage(p);
    const price = CloverStore.cardPrice(p);
    const vid = p.variants[0]?.id || "";
    return `
      <article class="product-card">
        <a class="product-card__link" href="product.html?id=${encodeURIComponent(p.id)}">
          <div class="product-card__img">
            <img src="${img}" alt="${p.name}" loading="lazy" />
          </div>
          <div class="product-card__body">
            <span class="product-card__cat">${p.category.replace(/-/g, " ")}</span>
            <h3 class="product-card__name">${p.name}</h3>
            <div class="product-card__row">
              <span class="product-card__price">From $${price}</span>
            </div>
          </div>
        </a>
      </article>`;
  }

  function refresh() {
    if (!grid) return;
    const ids = typeof CloverCMS !== "undefined" ? CloverCMS.getHomepageProductIds() : null;
    const products = CloverStore.featuredProducts(8, ids);
    grid.innerHTML = products.map(renderCard).join("");
    if (typeof CloverMedia !== "undefined") CloverMedia.hydrateImages(grid);
    if (window.CloverVE?.refresh) window.CloverVE.refresh();
  }

  window.__homeRefresh = refresh;
  refresh();

  document.getElementById("newsletterForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    showToast("You're on the list — welcome to THE CLOVER");
    e.target.reset();
  });
})();
