/** THE CLOVER — Shopping cart */
(function (global) {
  const KEY = "clover_cart";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: items }));
  }

  function lineKey(item) {
    return item.sku || `${item.code}::${item.size}`;
  }

  function getItems() {
    return load();
  }

  function count() {
    return load().reduce((sum, i) => sum + (i.qty || 1), 0);
  }

  function subtotal() {
    return load().reduce((sum, i) => sum + i.price * (i.qty || 1), 0);
  }

  function add(line, size, qty) {
    const items = load();
    const sku = line.sku || line.code;
    const existing = items.find((i) => lineKey(i) === lineKey({ sku, size }));
    if (existing) {
      existing.qty = (existing.qty || 1) + (qty || 1);
    } else {
      items.push({
        sku,
        productId: line.productId,
        variantId: line.variantId,
        code: sku,
        name: line.name,
        colorName: line.colorName,
        color: line.color,
        price: line.price,
        image: line.image,
        size: size || line.size || "M",
        qty: qty || 1,
      });
    }
    save(items);
    return items;
  }

  function updateQty(sku, size, qty) {
    let items = load();
    const item = items.find((i) => lineKey(i) === lineKey({ sku, size }));
    if (!item) return items;
    if (qty < 1) {
      items = items.filter((i) => lineKey(i) !== lineKey({ sku, size }));
    } else {
      item.qty = qty;
    }
    save(items);
    return items;
  }

  function remove(sku, size) {
    const items = load().filter((i) => lineKey(i) !== lineKey({ sku, size }));
    save(items);
    return items;
  }

  function clear() {
    save([]);
    return [];
  }

  global.CloverCart = { getItems, count, subtotal, add, updateQty, remove, clear, KEY };
})(typeof window !== "undefined" ? window : global);
