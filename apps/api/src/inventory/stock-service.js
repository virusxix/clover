/**
 * Stock service
 * -------------
 * One job: read and change inventory_levels safely, with a movement log.
 * All qty changes go through adjustStock / transferStock (never raw UPDATEs elsewhere).
 */

import { LOCATIONS } from "./locations.js";

/**
 * Read qty at one location (0 if missing).
 * @param {import("pg").PoolClient | { query: Function }} db
 */
export async function getQty(db, { variantId, locationId, size }) {
  const { rows } = await db.query(
    `SELECT qty FROM inventory_levels
     WHERE variant_id = $1 AND location_id = $2 AND size = $3`,
    [variantId, locationId, size]
  );
  return rows[0]?.qty ?? 0;
}

/**
 * Lock and return qty (FOR UPDATE). Call inside an open transaction.
 */
export async function lockQty(db, { variantId, locationId, size }) {
  const { rows } = await db.query(
    `SELECT qty FROM inventory_levels
     WHERE variant_id = $1 AND location_id = $2 AND size = $3
     FOR UPDATE`,
    [variantId, locationId, size]
  );
  return rows[0]?.qty ?? 0;
}

/**
 * Change stock at one location by delta (+ receive, − sell).
 * Writes inventory_movements. Throws if result would go negative.
 */
export async function adjustStock(
  db,
  {
    variantId,
    locationId,
    size,
    delta,
    reason,
    refType = null,
    refId = null,
    notes = "",
    createdBy = null,
    fromLocation = null,
    toLocation = null,
  }
) {
  if (!delta) return;

  const current = await lockQty(db, { variantId, locationId, size });
  const next = current + delta;
  if (next < 0) {
    const err = new Error(`Insufficient stock at ${locationId} (have ${current}, need ${-delta})`);
    err.status = 400;
    throw err;
  }

  await db.query(
    `INSERT INTO inventory_levels (variant_id, location_id, size, qty, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (variant_id, location_id, size)
     DO UPDATE SET qty = EXCLUDED.qty, updated_at = NOW()`,
    [variantId, locationId, size, next]
  );

  await db.query(
    `INSERT INTO inventory_movements (
       variant_id, size, qty, from_location, to_location,
       reason, ref_type, ref_id, notes, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      variantId,
      size,
      delta,
      fromLocation,
      toLocation,
      reason,
      refType,
      refId,
      notes,
      createdBy,
    ]
  );

  // Keep legacy JSONB in sync for website (catalog still reads it in some paths)
  if (locationId === LOCATIONS.WEBSITE) {
    await syncLegacyWebsiteStock(db, variantId, size, next);
  }
}

/**
 * Move qty from one location to another (e.g. store → iconic).
 */
export async function transferStock(
  db,
  { variantId, size, qty, fromLocation, toLocation, reason, refType, refId, notes, createdBy }
) {
  if (qty <= 0) {
    const err = new Error("Transfer qty must be positive");
    err.status = 400;
    throw err;
  }

  await adjustStock(db, {
    variantId,
    locationId: fromLocation,
    size,
    delta: -qty,
    reason,
    refType,
    refId,
    notes,
    createdBy,
    fromLocation,
    toLocation,
  });

  await adjustStock(db, {
    variantId,
    locationId: toLocation,
    size,
    delta: qty,
    reason,
    refType,
    refId,
    notes,
    createdBy,
    fromLocation,
    toLocation,
  });
}

/** Mirror website qty into product_variants.stock JSONB for backward compatibility. */
async function syncLegacyWebsiteStock(db, variantId, size, qty) {
  await db.query(
    `UPDATE product_variants
     SET stock = jsonb_set(COALESCE(stock, '{}'::jsonb), ARRAY[$2], to_jsonb($3::int), true)
     WHERE id = $1`,
    [variantId, size, qty]
  );
}

/**
 * List inventory rows for admin (optional filters).
 */
export async function listInventory(db, { locationId = null, q = "" } = {}) {
  const params = [];
  const where = ["1=1"];

  if (locationId) {
    params.push(locationId);
    where.push(`il.location_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(
      `(p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length} OR p.product_code ILIKE $${params.length})`
    );
  }

  const { rows } = await db.query(
    `SELECT
       il.variant_id, il.location_id, il.size, il.qty, il.updated_at,
       p.id AS product_id, p.name AS product_name, p.slug, p.product_code,
       v.color_name, v.variant_key, v.price_cents, v.cost_cents
     FROM inventory_levels il
     JOIN product_variants v ON v.id = il.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE ${where.join(" AND ")} AND il.qty > 0
     ORDER BY p.name, v.color_name, il.size, il.location_id`,
    params
  );
  return rows;
}
