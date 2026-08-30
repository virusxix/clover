export const CURRENCY_CODE = "MMK";
export const CURRENCY_SYMBOL = "Ks";
export const FREE_SHIPPING_MIN_MMK = 150_000;
export const SHIPPING_FEE_MMK = 12_000;
export const TAX_RATE = 0.05;

/** Format whole kyat amounts — e.g. 185,000 Ks */
export function formatMMK(amount: number) {
  const n = Math.round(amount);
  return `${n.toLocaleString("en-US")} ${CURRENCY_SYMBOL}`;
}

export function computeOrderTotals(subtotalMmk: number) {
  const subtotal = Math.round(subtotalMmk);
  const shipping = subtotal >= FREE_SHIPPING_MIN_MMK ? 0 : SHIPPING_FEE_MMK;
  const tax = Math.round(subtotal * TAX_RATE);
  return {
    subtotal,
    shipping,
    tax,
    total: subtotal + shipping + tax,
    freeShipping: subtotal >= FREE_SHIPPING_MIN_MMK,
    amountUntilFreeShipping:
      subtotal >= FREE_SHIPPING_MIN_MMK ? 0 : FREE_SHIPPING_MIN_MMK - subtotal,
  };
}
