/**
 * Store sales (physical POS)
 * --------------------------
 * Walk-in sale + STORE stock deduct.
 * Supports per-line discounts and an optional order-level discount (MMK).
 */

import { getPool } from "../pg-pool.js";
import { LOCATIONS } from "../inventory/locations.js";
import { adjustStock } from "../inventory/stock-service.js";

/**
 * @param {{
 *   items: Array<{ variantId, size, quantity, unitPrice, discount? }>,
 *   notes?, soldAt?, createdBy?, paymentMethod?,
 *   discount?: number  // order-level MMK off after line discounts
 * }}
 */
export async function createStoreSale({
  items,
  notes = "",
  soldAt = new Date(),
  createdBy = null,
  paymentMethod = "cash",
  discount = 0,
  customerId = null,
}) {
  if (!items?.length) {
    const err = new Error("Sale needs at least one item");
    err.status = 400;
    throw err;
  }

  const orderDiscount = Math.max(0, Math.round(Number(discount) || 0));

  const client = await getPool().then((p) => p.connect());
  try {
    await client.query("BEGIN");

    let grossSubtotal = 0;
    let lineDiscountsTotal = 0;
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
      const qty = line.quantity;
      const lineGross = unitPrice * qty;
      const lineDiscount = Math.min(
        lineGross,
        Math.max(0, Math.round(Number(line.discount) || 0))
      );
      const lineTotal = lineGross - lineDiscount;

      grossSubtotal += lineGross;
      lineDiscountsTotal += lineDiscount;

      resolved.push({
        variantId: v.id,
        productName: v.name,
        productCode: v.product_code,
        variantName: v.color_name,
        size: line.size,
        quantity: qty,
        unitPrice,
        unitCost: v.cost_cents,
        discount: lineDiscount,
        lineTotal,
      });
    }

    const afterLines = grossSubtotal - lineDiscountsTotal;
    if (orderDiscount > afterLines) {
      const err = new Error("Order discount cannot be greater than the amount after item discounts");
      err.status = 400;
      throw err;
    }

    const total = afterLines - orderDiscount;

    const saleNotes = [notes, paymentMethod ? `pay:${paymentMethod}` : ""]
      .filter(Boolean)
      .join(" · ");

    const { rows: saleRows } = await client.query(
      `INSERT INTO store_sales (sold_at, total_cents, discount_cents, notes, created_by, customer_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, sold_at, total_cents, discount_cents, notes, customer_id`,
      [soldAt, total, orderDiscount, saleNotes, createdBy, customerId || null]
    );
    const sale = saleRows[0];

    for (const line of resolved) {
      await client.query(
        `INSERT INTO store_sale_items (
           sale_id, variant_id, product_name, variant_name, size,
           quantity, unit_price_cents, unit_cost_cents, discount_cents
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          sale.id,
          line.variantId,
          line.productName,
          line.variantName,
          line.size,
          line.quantity,
          line.unitPrice,
          line.unitCost,
          line.discount,
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
      subtotal: grossSubtotal,
      itemDiscount: lineDiscountsTotal,
      discount: sale.discount_cents,
      total: sale.total_cents,
      notes: sale.notes,
      paymentMethod,
      customerId: sale.customer_id || null,
      channel: "store",
      items: resolved.map((line) => ({
        ...line,
        colorName: line.variantName,
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
    `SELECT id, sold_at, total_cents, discount_cents, notes, created_at, customer_id
     FROM store_sales WHERE id = $1`,
    [saleId]
  );
  if (!rows.length) return null;

  const { rows: items } = await db.query(
    `SELECT i.id, i.variant_id, i.product_name, i.variant_name, i.size,
            i.quantity, i.unit_price_cents, i.unit_cost_cents,
            COALESCE(i.discount_cents, 0)::int AS discount_cents,
            p.product_code
     FROM store_sale_items i
     LEFT JOIN product_variants v ON v.id = i.variant_id
     LEFT JOIN products p ON p.id = v.product_id
     WHERE i.sale_id = $1
     ORDER BY i.product_name, i.size`,
    [saleId]
  );

  const sale = rows[0];
  const mapped = items.map((i) => {
    const lineGross = i.unit_price_cents * i.quantity;
    const discount = i.discount_cents || 0;
    return {
      id: i.id,
      variantId: i.variant_id,
      productName: i.product_name,
      productCode: i.product_code,
      colorName: i.variant_name,
      variantName: i.variant_name,
      size: i.size,
      quantity: i.quantity,
      unitPrice: i.unit_price_cents,
      unitCost: i.unit_cost_cents,
      discount,
      lineTotal: lineGross - discount,
    };
  });
  const subtotal = mapped.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemDiscount = mapped.reduce((s, i) => s + (i.discount || 0), 0);

  return {
    saleId: sale.id,
    soldAt: sale.sold_at,
    subtotal,
    itemDiscount,
    discount: sale.discount_cents ?? 0,
    total: sale.total_cents,
    notes: stripPayFromNotes(sale.notes),
    paymentMethod: parsePayMethod(sale.notes),
    customerId: sale.customer_id || null,
    channel: "store",
    items: mapped,
  };
}

/**
 * Replace receipt lines (admin). Restocks old items, then deducts the new cart.
 */
export async function updateStoreSale({
  saleId,
  items,
  notes = "",
  paymentMethod = "cash",
  discount = 0,
  customerId = undefined,
  createdBy = null,
}) {
  if (!items?.length) {
    const err = new Error("Sale needs at least one item");
    err.status = 400;
    throw err;
  }

  const orderDiscount = Math.max(0, Math.round(Number(discount) || 0));
  const client = await getPool().then((p) => p.connect());

  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      `SELECT id, notes, customer_id, sold_at FROM store_sales WHERE id = $1 FOR UPDATE`,
      [saleId]
    );
    if (!existing.length) {
      const err = new Error("Sale not found");
      err.status = 404;
      throw err;
    }

    const { rows: oldItems } = await client.query(
      `SELECT variant_id, size, quantity FROM store_sale_items WHERE sale_id = $1`,
      [saleId]
    );

    // Return stock from the previous receipt before applying the new cart.
    for (const line of oldItems) {
      await adjustStock(client, {
        variantId: line.variant_id,
        locationId: LOCATIONS.STORE,
        size: line.size,
        delta: line.quantity,
        reason: "sale_store_edit",
        refType: "store_sale",
        refId: saleId,
        createdBy,
        fromLocation: null,
        toLocation: LOCATIONS.STORE,
        notes: "Receipt edit — restock previous lines",
      });
    }

    await client.query(`DELETE FROM store_sale_items WHERE sale_id = $1`, [saleId]);

    let grossSubtotal = 0;
    let lineDiscountsTotal = 0;
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
      const qty = line.quantity;
      const lineGross = unitPrice * qty;
      const lineDiscount = Math.min(
        lineGross,
        Math.max(0, Math.round(Number(line.discount) || 0))
      );

      grossSubtotal += lineGross;
      lineDiscountsTotal += lineDiscount;

      resolved.push({
        variantId: v.id,
        productName: v.name,
        productCode: v.product_code,
        variantName: v.color_name,
        size: line.size,
        quantity: qty,
        unitPrice,
        unitCost: v.cost_cents,
        discount: lineDiscount,
        lineTotal: lineGross - lineDiscount,
      });
    }

    const afterLines = grossSubtotal - lineDiscountsTotal;
    if (orderDiscount > afterLines) {
      const err = new Error("Order discount cannot be greater than the amount after item discounts");
      err.status = 400;
      throw err;
    }
    const total = afterLines - orderDiscount;
    const saleNotes = buildSaleNotes(notes, paymentMethod);
    const nextCustomerId =
      customerId === undefined ? existing[0].customer_id : customerId || null;

    await client.query(
      `UPDATE store_sales
       SET total_cents = $2,
           discount_cents = $3,
           notes = $4,
           customer_id = $5
       WHERE id = $1`,
      [saleId, total, orderDiscount, saleNotes, nextCustomerId]
    );

    for (const line of resolved) {
      await client.query(
        `INSERT INTO store_sale_items (
           sale_id, variant_id, product_name, variant_name, size,
           quantity, unit_price_cents, unit_cost_cents, discount_cents
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          saleId,
          line.variantId,
          line.productName,
          line.variantName,
          line.size,
          line.quantity,
          line.unitPrice,
          line.unitCost,
          line.discount,
        ]
      );

      await adjustStock(client, {
        variantId: line.variantId,
        locationId: LOCATIONS.STORE,
        size: line.size,
        delta: -line.quantity,
        reason: "sale_store",
        refType: "store_sale",
        refId: saleId,
        createdBy,
        fromLocation: LOCATIONS.STORE,
        toLocation: null,
        notes: "Receipt edit — apply new lines",
      });
    }

    await client.query("COMMIT");

    return {
      saleId,
      soldAt: existing[0].sold_at,
      subtotal: grossSubtotal,
      itemDiscount: lineDiscountsTotal,
      discount: orderDiscount,
      total,
      notes: saleNotes,
      paymentMethod,
      customerId: nextCustomerId,
      channel: "store",
      items: resolved.map((line) => ({
        ...line,
        colorName: line.variantName,
      })),
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Void a store receipt (admin). Restocks store inventory, then deletes the sale.
 */
export async function deleteStoreSale({ saleId, createdBy = null }) {
  const client = await getPool().then((p) => p.connect());
  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      `SELECT id FROM store_sales WHERE id = $1 FOR UPDATE`,
      [saleId]
    );
    if (!existing.length) {
      const err = new Error("Sale not found");
      err.status = 404;
      throw err;
    }

    const { rows: oldItems } = await client.query(
      `SELECT variant_id, size, quantity FROM store_sale_items WHERE sale_id = $1`,
      [saleId]
    );

    for (const line of oldItems) {
      await adjustStock(client, {
        variantId: line.variant_id,
        locationId: LOCATIONS.STORE,
        size: line.size,
        delta: line.quantity,
        reason: "sale_store_void",
        refType: "store_sale",
        refId: saleId,
        createdBy,
        fromLocation: null,
        toLocation: LOCATIONS.STORE,
        notes: "Receipt deleted — restock",
      });
    }

    await client.query(`DELETE FROM store_sales WHERE id = $1`, [saleId]);
    await client.query("COMMIT");
    return { ok: true, saleId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function parsePayMethod(notes) {
  const m = String(notes || "").match(/pay:([a-z0-9_]+)/i);
  return m ? m[1] : "cash";
}

function stripPayFromNotes(notes) {
  return String(notes || "")
    .replace(/\s*·\s*pay:[a-z0-9_]+/gi, "")
    .replace(/pay:[a-z0-9_]+/gi, "")
    .replace(/\s*·\s*$/g, "")
    .trim();
}

function buildSaleNotes(notes, paymentMethod) {
  const clean = stripPayFromNotes(notes);
  return [clean, paymentMethod ? `pay:${paymentMethod}` : ""].filter(Boolean).join(" · ");
}
