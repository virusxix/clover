import { formatMMK } from "@/lib/currency";

/** Fallback when settings API unavailable (server uses DB value) */
export const DEFAULT_SALE_DISCOUNT_PERCENT = 20;

export function isOnSale(tags?: string[]) {
  return tags?.includes("sale") ?? false;
}

export function formatPrice(amount: number) {
  return formatMMK(amount);
}
