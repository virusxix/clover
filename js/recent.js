/** THE CLOVER — Recently viewed products */
(function (global) {
  const KEY = "clover_recent";
  const MAX = 8;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function save(ids) {
    localStorage.setItem(KEY, JSON.stringify(ids));
  }

  function track(productId) {
    if (!productId) return;
    let ids = load().filter((id) => id !== productId);
    ids.unshift(productId);
    ids = ids.slice(0, MAX);
    save(ids);
  }

  function getProducts() {
    return load()
      .map((id) => CloverStore.getProduct(id))
      .filter(Boolean);
  }

  global.CloverRecent = { track, getProducts, load, KEY };
})(typeof window !== "undefined" ? window : global);
