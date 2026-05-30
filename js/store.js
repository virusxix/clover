/** THE CLOVER — Product catalog API (v3 grouped products + variants) */
(function (global) {
  const KEY = "clover_catalog";
  const VERSION_KEY = "clover_catalog_version";
  const CATALOG_VERSION = 7;

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function useDraftCatalog() {
    return typeof CloverVE !== "undefined" && CloverVE.useDraft();
  }

  function loadPublishedCatalog() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return clone(CloverCatalogData.PRODUCTS);
  }

  function loadCatalog() {
    if (useDraftCatalog()) {
      try {
        if (typeof CloverVE !== "undefined") CloverVE.ensureDrafts();
        const raw = localStorage.getItem("clover_catalog_draft");
        if (raw) return JSON.parse(raw);
      } catch (_) {}
    }
    try {
      const ver = localStorage.getItem(VERSION_KEY);
      if (ver !== String(CATALOG_VERSION)) {
        const fresh = clone(CloverCatalogData.PRODUCTS);
        localStorage.setItem(VERSION_KEY, String(CATALOG_VERSION));
        localStorage.setItem(KEY, JSON.stringify(fresh));
        if (typeof CloverVE !== "undefined") CloverVE.ensureDrafts();
        return fresh;
      }
      return loadPublishedCatalog();
    } catch (_) {}
    const fresh = clone(CloverCatalogData.PRODUCTS);
    localStorage.setItem(KEY, JSON.stringify(fresh));
    localStorage.setItem(VERSION_KEY, String(CATALOG_VERSION));
    return fresh;
  }

  function saveCatalog(products) {
    const live = !useDraftCatalog();
    if (!live) {
      localStorage.setItem("clover_catalog_draft", JSON.stringify(products));
      window.dispatchEvent(new CustomEvent("catalog:draft"));
      return;
    }
    localStorage.setItem(KEY, JSON.stringify(products));
    localStorage.setItem("clover_catalog_draft", JSON.stringify(products));
    if (typeof CloverMedia !== "undefined" && CloverMedia.embedPublishedMedia) {
      CloverMedia.embedPublishedMedia(null, products).catch(() => {});
    }
    window.dispatchEvent(new CustomEvent("catalog:updated"));
  }

  function getProducts() {
    return loadCatalog();
  }

  function getProduct(id) {
    return loadCatalog().find((p) => p.id === id);
  }

  function getVariant(productId, variantId) {
    const p = getProduct(productId);
    return p?.variants?.find((v) => v.id === variantId) || null;
  }

  function getCategories() {
    if (typeof CloverCMS !== "undefined") return CloverCMS.getCategories();
    return CloverCatalogData.CATEGORIES;
  }

  function getSizes() {
    return CloverCatalogData.SIZES;
  }

  /** Card thumbnail: first image of first variant */
  function cardImage(product) {
    return product?.variants?.[0]?.images?.[0]?.src || "";
  }

  function cardPrice(product) {
    const prices = (product?.variants || []).map((v) => v.salePrice ?? v.price);
    if (!prices.length) return 0;
    return Math.min(...prices);
  }

  function variantStock(variant) {
    if (!variant?.stock) return 0;
    return Object.values(variant.stock).reduce((a, b) => a + b, 0);
  }

  function isInStock(product, variantId, size) {
    const v = getVariant(product.id, variantId);
    if (!v) return false;
    return (v.stock?.[size] ?? 0) > 0;
  }

  /** Legacy flat list for admin table */
  function getFlatList() {
    const rows = [];
    getProducts().forEach((p) => {
      p.variants.forEach((v) => {
        rows.push({
          code: CloverCatalogData.sku(p.id, v.id, "M"),
          productId: p.id,
          variantId: v.id,
          name: `${p.name} — ${v.name}`,
          color: v.hex,
          price: v.price,
          category: p.category,
          image: v.images[0]?.src || "",
          stock: variantStock(v),
        });
      });
    });
    return rows;
  }

  function getByCode(code) {
    const flat = getFlatList();
    return flat.find((r) => r.code === code);
  }

  function storefrontProducts() {
    return getProducts().filter((p) => (p.status || "active") === "active");
  }

  function filterProducts(opts = {}) {
    let list = opts.includeAll ? getProducts() : storefrontProducts();
    const q = (opts.query || "").trim().toLowerCase();
    const cat = opts.category || "all";
    const color = (opts.color || "").toLowerCase();
    const maxPrice = opts.maxPrice;
    const inStockOnly = opts.inStockOnly;

    if (cat && cat !== "all") {
      list = list.filter((p) => p.category === cat);
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q)) ||
          p.variants.some((v) => v.name.toLowerCase().includes(q))
      );
    }
    if (color) {
      list = list.filter((p) =>
        p.variants.some((v) => v.name.toLowerCase().includes(color) || v.id === color)
      );
    }
    if (maxPrice != null) {
      list = list.filter((p) => cardPrice(p) <= maxPrice);
    }
    if (inStockOnly) {
      list = list.filter((p) => p.variants.some((v) => variantStock(v) > 0));
    }
    return list;
  }

  function featuredProducts(limit = 8, ids) {
    if (ids?.length) {
      const map = new Map(getProducts().map((p) => [p.id, p]));
      return ids.map((id) => map.get(id)).filter(Boolean).slice(0, limit);
    }
    const list = storefrontProducts();
    const featured = list.filter((p) => p.featured);
    const rest = list.filter((p) => !p.featured);
    return [...featured, ...rest].slice(0, limit);
  }

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function addProduct(data) {
    const list = loadCatalog();
    const id = data.id || slugify(data.name) || `product-${Date.now()}`;
    if (list.some((p) => p.id === id)) throw new Error("Product ID already exists");
    const product = {
      id,
      name: data.name || "New Product",
      description: data.description || "",
      category: data.category || "tops",
      tags: data.tags || [],
      featured: !!data.featured,
      status: data.status || "active",
      brand: data.brand || "THE CLOVER",
      sku: data.sku || id.toUpperCase(),
      variants: data.variants?.length
        ? data.variants
        : [
            {
              id: "default",
              name: "Default",
              hex: "#1a1a1a",
              price: 0,
              salePrice: null,
              images: [],
              videos: [],
              stock: { XS: 0, S: 0, M: 0, L: 0, XL: 0 },
            },
          ],
    };
    list.push(product);
    saveCatalog(list);
    return product;
  }

  function saveProduct(product) {
    const list = loadCatalog();
    const i = list.findIndex((p) => p.id === product.id);
    if (i === -1) throw new Error("Product not found");
    list[i] = product;
    saveCatalog(list);
    return product;
  }

  function setProductStatus(productId, status) {
    return updateProduct(productId, { status });
  }

  /** Cart line item from PDP */
  function lineItem(productId, variantId, size, qty = 1) {
    const p = getProduct(productId);
    const v = getVariant(productId, variantId);
    if (!p || !v) return null;
    return {
      sku: CloverCatalogData.sku(productId, variantId, size),
      productId,
      variantId,
      code: CloverCatalogData.sku(productId, variantId, size),
      name: p.name,
      colorName: v.name,
      color: v.hex,
      price: v.salePrice ?? v.price,
      image: v.images[0]?.src || "",
      size,
      qty,
    };
  }

  function cleanupReport() {
    const products = getProducts();
    const issues = [];
    const imageSet = new Set();

    products.forEach((p) => {
      if (!p.variants?.length) issues.push({ type: "missing_variants", productId: p.id });
      p.variants.forEach((v) => {
        if (!v.images?.length) issues.push({ type: "missing_images", productId: p.id, variantId: v.id });
        v.images.forEach((img) => {
          if (imageSet.has(img.src)) {
            issues.push({ type: "duplicate_image", src: img.src, productId: p.id });
          }
          imageSet.add(img.src);
        });
      });
    });

    return {
      productCount: products.length,
      variantCount: products.reduce((n, p) => n + p.variants.length, 0),
      issues,
      fixed: "Catalog v3 uses grouped products; color swatches only swap images within the same product.",
    };
  }

  function reset() {
    localStorage.setItem(VERSION_KEY, String(CATALOG_VERSION));
    saveCatalog(clone(CloverCatalogData.PRODUCTS));
    return loadCatalog();
  }

  function updateProduct(productId, patch) {
    const list = loadCatalog();
    const i = list.findIndex((p) => p.id === productId);
    if (i === -1) return list;
    list[i] = { ...list[i], ...patch };
    saveCatalog(list);
    return list;
  }

  function removeProduct(productId) {
    const list = loadCatalog().filter((p) => p.id !== productId);
    saveCatalog(list);
    return list;
  }

  function duplicateProduct(productId) {
    const p = getProduct(productId);
    if (!p) return loadCatalog();
    const copy = clone(p);
    copy.id = `${p.id}-copy-${Date.now()}`;
    copy.name = `${p.name} (Copy)`;
    const list = loadCatalog();
    list.push(copy);
    saveCatalog(list);
    return list;
  }

  // Legacy compatibility
  function getAll() {
    return getFlatList();
  }

  function add(row) {
    console.warn("Use admin catalog editor for grouped products; flat add deprecated.");
    return getFlatList();
  }

  function remove(code) {
    const { productId } = CloverCatalogData.parseSku(code);
    if (productId) return removeProduct(productId);
    return getFlatList();
  }

  global.CloverStore = {
    CATALOG_VERSION,
    getProducts,
    getProduct,
    getVariant,
    getCategories,
    getSizes,
    cardImage,
    cardPrice,
    variantStock,
    isInStock,
    filterProducts,
    featuredProducts,
    lineItem,
    cleanupReport,
    getFlatList,
    getByCode,
    reset,
    updateProduct,
    removeProduct,
    duplicateProduct,
    addProduct,
    saveProduct,
    setProductStatus,
    storefrontProducts,
    slugify,
    saveCatalog,
    getAll,
    add,
    remove,
    KEY,
    VERSION_KEY,
  };
})(typeof window !== "undefined" ? window : global);
