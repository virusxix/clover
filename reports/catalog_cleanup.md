# THE CLOVER — Catalog Cleanup Report (v3)

Generated from grouped product catalog (`js/catalog-data.js`).

## Summary

| Metric | Value |
|--------|-------|
| Catalog version | 3 |
| Structure | Product → Color variants → Images + stock per size |
| Color swatch behavior | Images swap **only** within the selected variant of the **same** product |

## Fixes applied

- **Grouped products**: Each SKU photo cluster is one product with multiple color variants instead of 27 separate flat SKUs.
- **Color isolation**: Jacket colors (e.g. Yellow) use only that variant's `images[]` array — never bra or other product assets.
- **Categories**: Jackets, long-sleeve, hoodies, shorts, leggings, tops, accessories.
- **PDP**: `product.html` with gallery, thumbnails, zoom lightbox, mobile swipe.
- **Cart**: Line items keyed by `productId::variantId::size` with `colorName` displayed.

## Known duplicates (optional merge)

- `ribbed-zip-jacket` and `ribbed-zip-lifestyle` share the same garment; lifestyle shots could be merged into the main jacket's charcoal variant.

## Admin

- Dashboard shows live cleanup report via `CloverStore.cleanupReport()`.
- Export catalog JSON, duplicate product, delete product, reset to defaults.

## How to refresh local data

Hard refresh or clear `localStorage` keys `clover_catalog` and `clover_catalog_version`, then reload — catalog resets to v3 defaults.
