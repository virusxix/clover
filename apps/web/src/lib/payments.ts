/**
 * Shared payment method labels (website + POS).
 */

export const POS_PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "kbzpay", label: "KBZPay" },
  { id: "mmqr", label: "MMQR" },
  { id: "card", label: "Card" },
] as const;

export const WEB_PAYMENT_METHODS = [
  { id: "cod", label: "Cash on delivery", hint: "Mandalay area only" },
  { id: "kbzpay", label: "KBZPay" },
  { id: "card", label: "Card" },
] as const;

export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number]["id"];
export type WebPaymentMethod = (typeof WEB_PAYMENT_METHODS)[number]["id"];

export const PAYMENT_LABELS: Record<string, string> = {
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
export function isMandalayArea(city?: string, state?: string): boolean {
  const hay = `${city || ""} ${state || ""}`.toLowerCase();
  return /mandalay|မန္တလေး|\bmdy\b/.test(hay);
}
