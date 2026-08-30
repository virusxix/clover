/** Store prices and order totals in whole MMK (column name price_cents = amount in kyat). */
export const CURRENCY_CODE = "MMK";
export const CURRENCY_SYMBOL = "Ks";
export const FREE_SHIPPING_MIN_MMK = 150_000;
export const SHIPPING_FEE_MMK = 12_000;
export const TAX_RATE = 0.05;

export function toDisplayAmount(stored) {
  return Math.round(Number(stored) || 0);
}

export function toStoredAmount(display) {
  return Math.round(Number(display) || 0);
}

export function computeOrderTotals(subtotalMmk) {
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
