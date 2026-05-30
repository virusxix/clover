/**
 * THE CLOVER — Canonical product catalog
 * Products → color variants → images (same product only per variant)
 * Color names verified against product photography.
 */
(function (global) {
  const SIZES = ["XS", "S", "M", "L", "XL"];

  const CATEGORIES = [
    { id: "all", label: "All" },
    { id: "jackets", label: "Jackets" },
    { id: "long-sleeve", label: "Long Sleeve" },
    { id: "short-sleeve", label: "Short Sleeve" },
    { id: "hoodies", label: "Hoodies" },
    { id: "shorts", label: "Shorts" },
    { id: "skirts", label: "Skirts" },
    { id: "leggings", label: "Leggings" },
    { id: "tops", label: "Tops & Bras" },
    { id: "accessories", label: "Accessories" },
  ];

  const PRODUCTS = [
    {
      id: "ribbed-zip-jacket",
      name: "Ribbed Zip Jacket",
      category: "jackets",
      tags: ["featured", "ribbed", "zip"],
      description:
        "Four-way stretch zip jacket engineered for training and everyday wear. Moisture-wicking fabric with zero-distraction seams.",
      featured: true,
      variants: [
        {
          id: "black",
          name: "Black",
          hex: "#1a1a1a",
          price: 148,
          images: [
            { src: "assets/photo_6111774033587147108_y.jpg", label: "Front view" },
            { src: "assets/photo_6111774033587147125_y.jpg", label: "Folded — black" },
            { src: "assets/photo_6111774033587147122_y.jpg", label: "Ribbed stack" },
            { src: "assets/product-stack-hero.png", label: "Hero stack" },
          ],
          stock: { XS: 4, S: 12, M: 18, L: 14, XL: 8 },
        },
        {
          id: "espresso",
          name: "Espresso",
          hex: "#4a3228",
          price: 148,
          images: [
            { src: "assets/photo_6111774033587147111_y.jpg", label: "Front view" },
            { src: "assets/photo_6111774033587147124_y.jpg", label: "Fabric stack" },
            { src: "assets/product-trio-flat.png", label: "Flat lay" },
            { src: "assets/product-zip-detail.png", label: "Zip detail" },
          ],
          stock: { XS: 4, S: 9, M: 14, L: 11, XL: 5 },
        },
        {
          id: "burgundy",
          name: "Burgundy",
          hex: "#6b2d3a",
          price: 148,
          images: [{ src: "assets/photo_6111774033587147110_y.jpg", label: "Front view" }],
          stock: { XS: 3, S: 9, M: 12, L: 8, XL: 5 },
        },
        {
          id: "navy",
          name: "Navy",
          hex: "#1e2a3a",
          price: 148,
          images: [{ src: "assets/photo_6111774033587147112_y.jpg", label: "Front view" }],
          stock: { XS: 4, S: 11, M: 14, L: 9, XL: 5 },
        },
        {
          id: "dusty-blue",
          name: "Dusty Blue",
          hex: "#7a8f9e",
          price: 148,
          images: [{ src: "assets/photo_6111774033587147107_y.jpg", label: "Front view" }],
          stock: { XS: 3, S: 8, M: 11, L: 7, XL: 4 },
        },
        {
          id: "charcoal",
          name: "Charcoal",
          hex: "#5c5c5c",
          price: 148,
          images: [
            { src: "assets/photo_6111774033587147126_y.jpg", label: "Four-color stack" },
            { src: "assets/product-stack-four.png", label: "Flat lay" },
          ],
          stock: { XS: 3, S: 10, M: 16, L: 12, XL: 6 },
        },
        {
          id: "cream",
          name: "Cream",
          hex: "#f0ebe3",
          price: 148,
          images: [
            { src: "assets/photo_6111774033587147125_y.jpg", label: "Folded trio" },
            { src: "assets/product-trio-fold.png", label: "Studio flat lay" },
            { src: "assets/photo_6111774033587147113_y.jpg", label: "Lifestyle" },
          ],
          stock: { XS: 5, S: 11, M: 15, L: 10, XL: 7 },
        },
      ],
    },
    {
      id: "front-zip-sports-bra",
      name: "Front Zip Sports Bra",
      category: "tops",
      tags: ["featured", "bra", "zip"],
      description:
        "Medium-support sports bra with a full front zipper and ruched bust panels. Smooth performance fabric — easy on, easy off.",
      featured: true,
      variants: [
        {
          id: "ice-blue",
          name: "Ice Blue",
          hex: "#c5d8e4",
          price: 72,
          images: [
            { src: "assets/hero-image.png", label: "Front — on model" },
          ],
          stock: { XS: 8, S: 14, M: 20, L: 12, XL: 6 },
        },
        {
          id: "dusty-rose",
          name: "Dusty Rose",
          hex: "#c4a0a8",
          price: 72,
          images: [{ src: "assets/photo_6111774033587147104_y.jpg", label: "Front — flat lay" }],
          stock: { XS: 5, S: 10, M: 14, L: 8, XL: 4 },
        },
      ],
    },
    {
      id: "scoop-sports-bra",
      name: "Scoop Sports Bra",
      category: "tops",
      tags: ["featured", "bra"],
      description:
        "Pull-on scoop-neck sports bra with Y-back straps. Smooth performance fabric, no zipper — light support for training and everyday wear.",
      featured: true,
      variants: [
        {
          id: "black",
          name: "Black",
          hex: "#1a1a1a",
          price: 58,
          images: [{ src: "assets/photo_6111774033587147088_y.png", label: "Front view" }],
          stock: { XS: 8, S: 15, M: 22, L: 14, XL: 7 },
        },
        {
          id: "caramel",
          name: "Caramel",
          hex: "#c49a6c",
          price: 58,
          images: [{ src: "assets/photo_6111774033587147089_y.png", label: "Front view" }],
          stock: { XS: 6, S: 12, M: 18, L: 11, XL: 5 },
        },
        {
          id: "cream",
          name: "Cream",
          hex: "#f2ede6",
          price: 58,
          images: [{ src: "assets/photo_6111774033587147090_y.png", label: "Front view" }],
          stock: { XS: 7, S: 14, M: 20, L: 12, XL: 6 },
        },
      ],
    },
    {
      id: "strappy-sports-bra",
      name: "Ribbed Strappy Sports Bra",
      category: "tops",
      tags: ["featured", "bra"],
      description:
        "Pull-on ribbed sports bra with criss-cross back straps and clover logo. No zipper — medium support for high-intensity training.",
      featured: true,
      variants: [
        {
          id: "mustard",
          name: "Mustard",
          hex: "#c9a227",
          price: 64,
          images: [
            { src: "assets/photo_6111774033587147097_y.jpg", label: "Front view" },
            { src: "assets/photo_6111774033587147099_y.jpg", label: "Back view" },
          ],
          stock: { XS: 6, S: 12, M: 18, L: 10, XL: 5 },
        },
        {
          id: "sage",
          name: "Sage",
          hex: "#9aa894",
          price: 64,
          images: [{ src: "assets/photo_6111774033587147101_y.jpg", label: "Back view" }],
          stock: { XS: 5, S: 11, M: 16, L: 9, XL: 4 },
        },
        {
          id: "espresso",
          name: "Espresso",
          hex: "#3d2c28",
          price: 64,
          images: [{ src: "assets/photo_6111774033587147098_y.jpg", label: "Front view" }],
          stock: { XS: 6, S: 13, M: 19, L: 11, XL: 5 },
        },
        {
          id: "mahogany",
          name: "Mahogany",
          hex: "#4a2c32",
          price: 64,
          images: [{ src: "assets/photo_6111774033587147096_y.jpg", label: "Back view" }],
          stock: { XS: 4, S: 9, M: 13, L: 8, XL: 4 },
        },
        {
          id: "cream",
          name: "Cream",
          hex: "#f2ede6",
          price: 64,
          images: [{ src: "assets/photo_6111774033587147100_y.jpg", label: "Back view" }],
          stock: { XS: 7, S: 14, M: 20, L: 12, XL: 6 },
        },
      ],
    },
    {
      id: "contour-training-tee",
      name: "Contour Training Tee",
      category: "short-sleeve",
      tags: ["featured", "tee"],
      description:
        "Fitted short-sleeve performance tee with princess seams and clover logo. Moisture-wicking fabric for gym and studio.",
      featured: true,
      variants: [
        {
          id: "charcoal",
          name: "Charcoal",
          hex: "#6b7280",
          price: 54,
          images: [{ src: "assets/photo_6111774033587147092_y.png", label: "Front view" }],
          stock: { XS: 6, S: 14, M: 20, L: 15, XL: 8 },
        },
        {
          id: "mint",
          name: "Mint",
          hex: "#b8d4c8",
          price: 54,
          images: [{ src: "assets/photo_6111774033587147091_y.png", label: "Front view" }],
          stock: { XS: 5, S: 12, M: 18, L: 12, XL: 6 },
        },
        {
          id: "lavender",
          name: "Lavender",
          hex: "#b8a8c8",
          price: 54,
          images: [{ src: "assets/photo_6111774033587147093_y.png", label: "Front view" }],
          stock: { XS: 5, S: 11, M: 16, L: 10, XL: 5 },
        },
      ],
    },
    {
      id: "flow-training-short",
      name: "Flow Training Short",
      category: "shorts",
      tags: [],
      description: "High-waisted flow shorts with side pockets and scrunch waistband.",
      featured: false,
      variants: [
        {
          id: "blush",
          name: "Blush",
          hex: "#e8c4c8",
          price: 76,
          images: [{ src: "assets/photo_6111774033587147094_y.png", label: "Front view" }],
          stock: { XS: 5, S: 12, M: 18, L: 14, XL: 7 },
        },
        {
          id: "black",
          name: "Black",
          hex: "#1a1a1a",
          price: 76,
          images: [{ src: "assets/photo_6111774033587147095_y.jpg", label: "Front view" }],
          stock: { XS: 6, S: 14, M: 20, L: 15, XL: 8 },
        },
      ],
    },
    {
      id: "tiered-athletic-skirt",
      name: "Tiered Athletic Skirt",
      category: "skirts",
      tags: ["featured"],
      description:
        "High-waisted tiered athletic skirt with clover logo. Lightweight flow for training, tennis, and studio.",
      featured: true,
      variants: [
        {
          id: "peach",
          name: "Peach",
          hex: "#e8c4b8",
          price: 68,
          images: [{ src: "assets/photo_6111774033587147102_y.png", label: "Front view" }],
          stock: { XS: 5, S: 12, M: 18, L: 12, XL: 6 },
        },
      ],
    },
    {
      id: "flare-compression-legging",
      name: "Flare Compression Legging",
      category: "leggings",
      tags: ["featured"],
      description: "High-rise flare legging with four-way stretch and clover logo waistband.",
      featured: true,
      variants: [
        {
          id: "espresso",
          name: "Espresso",
          hex: "#4a3228",
          price: 88,
          images: [{ src: "assets/photo_6111774033587147116_y.jpg", label: "Front view" }],
          stock: { XS: 4, S: 10, M: 16, L: 12, XL: 6 },
        },
        {
          id: "black",
          name: "Black",
          hex: "#111827",
          price: 88,
          images: [{ src: "assets/photo_6111774033587147117_y.jpg", label: "Front view" }],
          stock: { XS: 6, S: 14, M: 22, L: 16, XL: 10 },
        },
        {
          id: "charcoal",
          name: "Charcoal",
          hex: "#4a4f54",
          price: 88,
          images: [{ src: "assets/photo_6111774033587147118_y.png", label: "Front view" }],
          stock: { XS: 5, S: 12, M: 18, L: 14, XL: 8 },
        },
      ],
    },
  ];

  function sku(productId, variantId, size) {
    return `${productId}::${variantId}::${size}`;
  }

  function parseSku(skuStr) {
    const [productId, variantId, size] = String(skuStr).split("::");
    return { productId, variantId, size };
  }

  global.CloverCatalogData = {
    PRODUCTS,
    CATEGORIES,
    SIZES,
    sku,
    parseSku,
  };
})(typeof window !== "undefined" ? window : global);
