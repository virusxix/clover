/** Shared Vegety-style navigation for all storefront pages */
(function () {
  "use strict";

  const NAV_HTML = `
<header class="veg-header">
  <div class="veg-header__inner">
    <a href="index.html" class="veg-logo">
      <img src="assets/logo-icon.png" alt="THE CLOVER" class="veg-logo__icon" />
      <span class="veg-logo__text">THE CLOVER</span>
    </a>
    <button type="button" class="veg-header__menu" id="navToggle" aria-label="Open menu" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
    <nav class="veg-nav" id="siteNav" aria-label="Main">
      <a href="index.html" data-nav="home">Home</a>
      <a href="shop.html" data-nav="shop">Shop</a>
      <a href="about.html" data-nav="about">About</a>
      <a href="contact.html" data-nav="contact">Contact</a>
    </nav>
    <div class="veg-header__actions">
      <a href="shop.html" class="veg-icon-btn" id="navSearch" aria-label="Search shop">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
      </a>
      <a href="cart.html" class="veg-icon-btn" aria-label="Cart">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
        <span class="cart-badge" data-cart-count hidden>0</span>
      </a>
      <a href="shop.html" class="btn btn--dark btn--sm">Shop Now</a>
    </div>
  </div>
</header>`;

  const mount = document.getElementById("site-header");
  if (mount) {
    mount.outerHTML = NAV_HTML;
  }
})();
