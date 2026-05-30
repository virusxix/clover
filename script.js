(function () {
  "use strict";

  const pdpMain = document.getElementById("pdpMain");
  const thumbs = document.querySelectorAll(".pdp__thumb");
  const swatches = document.querySelectorAll(".pdp__swatch");
  const sizes = document.querySelectorAll(".pdp__size");
  const addBtn = document.getElementById("addToCart");
  const cartBadge = document.getElementById("cartBadge");
  const tabs = document.querySelectorAll(".catalog__tab");
  const products = document.querySelectorAll(".product");
  const wishes = document.querySelectorAll(".product__wish");

  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      thumbs.forEach((t) => t.classList.remove("is-active"));
      thumb.classList.add("is-active");
      const src = thumb.dataset.src;
      if (src && pdpMain) {
        pdpMain.src = src;
        pdpMain.alt = thumb.getAttribute("aria-label") || "";
      }
    });
  });

  swatches.forEach((sw) => {
    sw.addEventListener("click", () => {
      swatches.forEach((s) => {
        s.classList.remove("is-active");
        s.setAttribute("aria-checked", "false");
      });
      sw.classList.add("is-active");
      sw.setAttribute("aria-checked", "true");
    });
  });

  sizes.forEach((sz) => {
    sz.addEventListener("click", () => {
      sizes.forEach((s) => s.classList.remove("is-active"));
      sz.classList.add("is-active");
    });
  });

  addBtn?.addEventListener("click", () => {
    if (!cartBadge) return;
    const n = parseInt(cartBadge.textContent, 10) || 0;
    cartBadge.textContent = String(n + 1);
    addBtn.textContent = "Added!";
    setTimeout(() => {
      addBtn.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg> Add to cart';
    }, 1200);
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      const cat = tab.dataset.cat;
      products.forEach((p) => {
        const match = cat === "all" || p.dataset.cat === cat;
        p.classList.toggle("is-hidden", !match);
      });
    });
  });

  wishes.forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("is-liked");
      const liked = btn.classList.contains("is-liked");
      btn.setAttribute(
        "aria-label",
        liked ? "Remove from wishlist" : "Add to wishlist"
      );
      const svg = btn.querySelector("svg");
      if (svg) svg.setAttribute("fill", liked ? "currentColor" : "none");
    });
  });

  document.querySelectorAll(".pagination__num").forEach((num) => {
    num.addEventListener("click", () => {
      document.querySelectorAll(".pagination__num").forEach((n) => n.classList.remove("is-active"));
      num.classList.add("is-active");
    });
  });
})();
