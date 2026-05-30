/** THE CLOVER — Shared site UI */
(function () {
  "use strict";

  const SHIPPING = 12;
  const TAX_RATE = 0.08;

  function updateCartBadge() {
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = String(CloverCart.count());
      el.hidden = CloverCart.count() === 0;
    });
  }

  function setActiveNav() {
    const page = document.body.dataset.page;
    document.querySelectorAll(".nav__link[data-nav], .veg-nav a[data-nav]").forEach((a) => {
      a.classList.toggle("is-active", a.dataset.nav === page);
    });
  }

  function initMobileNav() {
    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("siteNav");
    toggle?.addEventListener("click", () => {
      nav?.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", nav?.classList.contains("is-open"));
    });
    nav?.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => nav?.classList.remove("is-open"));
    });
  }

  function formatMoney(n) {
    return "$" + Number(n).toFixed(2);
  }

  function orderTotals(subtotal) {
    const shipping = subtotal >= 150 ? 0 : SHIPPING;
    const tax = subtotal * TAX_RATE;
    const total = subtotal + shipping + tax;
    return { subtotal, shipping, tax, total };
  }

  window.CloverSite = { SHIPPING, TAX_RATE, updateCartBadge, formatMoney, orderTotals };

  function initFloatingNavScroll() {
    const header = document.querySelector(".veg-header");
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateCartBadge();
    setActiveNav();
    initMobileNav();
    initFloatingNavScroll();
  });

  window.addEventListener("cart:updated", updateCartBadge);
})();
