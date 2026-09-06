/**
 * Shared payment method ids/labels (API).
 */

export const POS_PAYMENT_METHODS = ["cash", "kbzpay", "mmqr", "card"];
export const WEB_PAYMENT_METHODS = ["cod", "kbzpay", "card"];

export const PAYMENT_LABELS = {
  cash: "Cash",
  kbzpay: "KBZPay",
  mmqr: "MMQR",
  card: "Card",
  cod: "Cash on delivery",
  transfer: "Transfer",
  other: "Other",
  mock: "Mock",
};

/** True when city/state looks like Mandalay (COD eligible). */
export function isMandalayArea(city = "", state = "") {
  const hay = `${city} ${state}`.toLowerCase();
  return /mandalay|မန္တလေး|\bmdy\b/.test(hay);
}
