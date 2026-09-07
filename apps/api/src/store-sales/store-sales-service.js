/**
 * Store sales (physical POS)
 * --------------------------
 * One job: record a walk-in sale and deduct STORE location stock.
 * Supports a seller-entered order discount (MMK) off the cart subtotal.
 */

import { getPool } from "../pg-pool.js";
import { LOCATIONS } from "../inventory/locations.js";
import { adjustStock } from "../inventory/stock-service.js";

/**
 * @param {{
 *   items: Array<{ variantId, size, quantity, unitPrice }>,
 *   notes?, soldAt?, createdBy?, paymentMethod?,
 *   discount?: number  // MMK whole units off the subtotal
 * }}
 */
export async function createStoreSale({
  items,
  notes = "",
  soldAt = new Date(),
  createdBy = null,
  paymentMethod = "cash",
  discount = 0,
}) {
  if (!items?.length) {
    const err = new Error("Sale needs at least one item");
    err.status = 400;
    throw err;
  }

  const discountAmt = Math.max(0, Math.round(Number(discount) || 0));

  const client = await getPool().then((p) => p.connect());
  try {
    await client.query("BEGIN");

    let subtotal = 0;
    const resolved = [];

    for (const line of items) {
      const { rows } = await client.query(
        `SELECT v.id, v.color_name, v.price_cents, v.cost_cents, p.name, p.product_code
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         WHERE v.id = $1`,
        [line.variantId]
      );
      if (!rows.length) {
        const err = new Error("Variant not found");
        err.status = 404;
        throw err;
      }
      const v = rows[0];
      const unitPrice = line.unitPrice ?? v.price_cents;
      subtotal += unitPrice * line.quantity;
      resolved.push({
        variantId: v.id,
        productName: v.name,
        productCode: v.product_code,
        variantName: v.color_name,
        size: line.size,
        quantity: line.quantity,
        unitPrice,
        unitCost: v.cost_cents,
      });
    }

    if (discountAmt > subtotal) {
      const err = new Error("Discount cannot be greater than the subtotal");
      err.status = 400;
      throw err;
    }

    const total = subtotal - discountAmt;

    const saleNotes = [notes, paymentMethod ? `pay:${paymentMethod}` : ""]
      .filter(Boolean)
      .join(" · ");

    const { rows: saleRows } = await client.query(
      `INSERT INTO store_sales (sold_at, total_cents, discount_cents, notes, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, sold_at, total_cents, discount_cents, notes`,
      [soldAt, total, discountAmt, saleNotes, createdBy]
    );
    const sale = saleRows[0];

    for (const line of resolved) {
      await client.query(
        `INSERT INTO store_sale_items (
           sale_id, variant_id, product_name, variant_name, size,
           quantity, unit_price_cents, unit_cost_cents
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          sale.id,
          line.variantId,
          line.productName,
          line.variantName,
          line.size,
          line.quantity,
          line.unitPrice,
          line.unitCost,
        ]
      );

      await adjustStock(client, {
        variantId: line.variantId,
        locationId: LOCATIONS.STORE,
        size: line.size,
        delta: -line.quantity,
        reason: "sale_store",
        refType: "store_sale",
        refId: sale.id,
        createdBy,
        fromLocation: LOCATIONS.STORE,
        toLocation: null,
      });
    }

    await client.query("COMMIT");
    return {
      saleId: sale.id,
      soldAt: sale.sold_at,
      subtotal,
      discount: sale.discount_cents,
      total: sale.total_cents,
      notes: sale.notes,
      paymentMethod,
      channel: "store",
      items: resolved.map((line) => ({
        ...line,
        colorName: line.variantName,
        lineTotal: line.unitPrice * line.quantity,
      })),
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function listStoreSales(db, { limit = 50 } = {}) {
  const { rows } = await db.query(
    `SELECT s.id, s.sold_at, s.total_cents, s.discount_cents, s.notes, s.created_at,
            COALESCE(SUM(i.quantity), 0)::int AS unit_count
     FROM store_sales s
     LEFT JOIN store_sale_items i ON i.sale_id = s.id
     GROUP BY s.id
     ORDER BY s.sold_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

/**
 * Full sale + line items for receipt reprint.
 */
export async function getStoreSaleById(db, saleId) {
  const { rows } = await db.query(
    `SELECT id, sold_at, total_cents, discount_cents, notes, created_at
     FROM store_sales WHERE id = $1`,
    [saleId]
  );
  if (!rows.length) return null;

  const { rows: items } = await db.query(
    `SELECT i.variant_id, i.product_name, i.variant_name, i.size,
            i.quantity, i.unit_price_cents, i.unit_cost_cents,
            p.product_code
     FROM store_sale_items i
     LEFT JOIN product_variants v ON v.id = i.variant_id
     LEFT JOIN products p ON p.id = v.product_id
     WHERE i.sale_id = $1
     ORDER BY i.product_name, i.size`,
    [saleId]
  );

  const sale = rows[0];
  const subtotal = items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0);
  const discount = sale.discount_cents ?? 0;
  return {
    saleId: sale.id,
    soldAt: sale.sold_at,
    subtotal,
    discount,
    total: sale.total_cents,
    notes: sale.notes,
    paymentMethod: parsePayMethod(sale.notes),
    channel: "store",
    items: items.map((i) => ({
      variantId: i.variant_id,
      productName: i.product_name,
      productCode: i.product_code,
      colorName: i.variant_name,
      variantName: i.variant_name,
      size: i.size,
      quantity: i.quantity,
      unitPrice: i.unit_price_cents,
      unitCost: i.unit_cost_cents,
      lineTotal: i.unit_price_cents * i.quantity,
    })),
  };
}

function parsePayMethod(notes) {
  const m = String(notes || "").match(/pay:([a-z0-9_]+)/i);
  return m ? m[1] : "cash";
}
