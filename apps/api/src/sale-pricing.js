/** Sale pricing in whole MMK */
export const DEFAULT_SALE_DISCOUNT_PERCENT = 20;

export function isOnSale(tags) {
  return Array.isArray(tags) && tags.includes("sale");
}

export function resolvePricing(priceMmk, tags, saleDiscountPercent = DEFAULT_SALE_DISCOUNT_PERCENT) {
  const amount = Math.round(Number(priceMmk) || 0);
  const pct = Math.min(90, Math.max(1, Math.round(Number(saleDiscountPercent) || DEFAULT_SALE_DISCOUNT_PERCENT)));

  if (!isOnSale(tags)) {
    return {
      onSale: false,
      price: amount,
      compareAtPrice: null,
      discountPercent: null,
    };
  }

  const salePrice = Math.round((amount * (100 - pct)) / 100);

  return {
    onSale: true,
    price: salePrice,
    compareAtPrice: amount,
    discountPercent: pct,
  };
}

export function getEffectivePriceMmk(priceMmk, tags, saleDiscountPercent) {
  return resolvePricing(priceMmk, tags, saleDiscountPercent).price;
}
