/** THE CLOVER — Wishlist */
(function (global) {
  const KEY = "clover_wishlist";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("wishlist:updated"));
  }

  function key(productId, variantId) {
    return `${productId}::${variantId || ""}`;
  }

  function has(productId, variantId) {
    const k = key(productId, variantId);
    return load().some((i) => key(i.productId, i.variantId) === k);
  }

  function toggle(productId, variantId) {
    const items = load();
    const k = key(productId, variantId);
    const idx = items.findIndex((i) => key(i.productId, i.variantId) === k);
    if (idx >= 0) items.splice(idx, 1);
    else items.push({ productId, variantId, addedAt: Date.now() });
    save(items);
    return idx < 0;
  }

  function getAll() {
    return load();
  }

  global.CloverWishlist = { load, has, toggle, getAll, KEY };
})(typeof window !== "undefined" ? window : global);
