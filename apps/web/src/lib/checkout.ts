/**
 * Checkout helpers (client)
 * -------------------------
 * Shared totals + Myanmar region list for the checkout form.
 * Card formatting helpers were removed — we never collect PAN/CVC.
 */

export {
  computeOrderTotals,
  FREE_SHIPPING_MIN_MMK,
  SHIPPING_FEE_MMK,
} from "@/lib/currency";

/** Common Myanmar regions for the address datalist. */
export const MM_REGIONS = [
  "Yangon",
  "Mandalay",
  "Naypyidaw",
  "Sagaing",
  "Bago",
  "Magway",
  "Ayeyarwady",
  "Tanintharyi",
  "Shan",
  "Kachin",
  "Kayin",
  "Mon",
  "Rakhine",
  "Chin",
  "Kayah",
] as const;
