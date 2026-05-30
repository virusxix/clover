import { query } from "./db.js";

const DEFAULT_SALE_PERCENT = 20;
let cachedSalePercent = null;

function clampPercent(n) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return DEFAULT_SALE_PERCENT;
  return Math.min(90, Math.max(1, v));
}

export async function getSaleDiscountPercent() {
  if (cachedSalePercent != null) return cachedSalePercent;
  try {
    const { rows } = await query(
      `SELECT sale_discount_percent FROM app_settings WHERE id = 1`
    );
    cachedSalePercent = rows.length ? clampPercent(rows[0].sale_discount_percent) : DEFAULT_SALE_PERCENT;
  } catch {
    cachedSalePercent = DEFAULT_SALE_PERCENT;
  }
  return cachedSalePercent;
}

export async function setSaleDiscountPercent(percent) {
  const value = clampPercent(percent);
  await query(
    `INSERT INTO app_settings (id, sale_discount_percent) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET sale_discount_percent = EXCLUDED.sale_discount_percent`,
    [value]
  );
  cachedSalePercent = value;
  return value;
}

export function clearSettingsCache() {
  cachedSalePercent = null;
}
