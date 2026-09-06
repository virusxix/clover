/**
 * Order status transitions
 * ------------------------
 * Handles inventory side-effects: restock on cancel, commit stock when
 * offline payment (KBZPay/card) is confirmed.
 */

import { getPool } from "../pg-pool.js";
import { LOCATIONS } from "../inventory/locations.js";
import { adjustStock } from "../inventory/stock-service.js";

/** Statuses that already hold website inventory for the order. */
const STOCK_HELD = new Set(["pending", "processing", "shipped", "delivered"]);

const ALLOWED = new Set([
  "awaiting_payment",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

/**
 * @param {string} orderId
 * @param {string} nextStatus
 * @param {{ adminUserId?: string|null }} [opts]
 */
export async function updateOrderStatus(orderId, nextStatus, opts = {}) {
  if (!ALLOWED.has(nextStatus)) {
    const err = new Error("Invalid status");
    err.status = 400;
    throw err;
  }

  const client = await getPool().then((p) => p.connect());
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [
      orderId,
    ]);
    if (!rows.length) {
      const err = new Error("Order not found");
      err.status = 404;
      throw err;
    }

    const order = rows[0];
    const prev = order.status;
    if (prev === nextStatus) {
      await client.query("COMMIT");
      return order;
    }

    // Offline payment confirmed → commit website stock, then move forward.
    if (prev === "awaiting_payment" && nextStatus !== "cancelled") {
      if (!["pending", "processing"].includes(nextStatus)) {
        const err = new Error("Confirm payment before shipping");
        err.status = 400;
        throw err;
      }
      await commitWebsiteStockForOrder(client, orderId, opts.adminUserId || null);
    }

    // Cancel releases reserved/sold website stock when it was held.
    if (nextStatus === "cancelled" && STOCK_HELD.has(prev)) {
      await restockWebsiteForOrder(client, orderId, opts.adminUserId || null);
    }

    // Cancelling unpaid orders: nothing to restock.
    if (prev === "awaiting_payment" && nextStatus === "cancelled") {
      /* no inventory change */
    }

    const { rows: updated } = await client.query(
      `UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [orderId, nextStatus]
    );

    await client.query("COMMIT");
    return updated[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function loadOrderItems(client, orderId) {
  const { rows } = await client.query(
    `SELECT variant_id, size, quantity, product_name
     FROM order_items WHERE order_id = $1`,
    [orderId]
  );
  return rows;
}

async function commitWebsiteStockForOrder(client, orderId, createdBy) {
  const items = await loadOrderItems(client, orderId);
  for (const item of items) {
    await adjustStock(client, {
      variantId: item.variant_id,
      locationId: LOCATIONS.WEBSITE,
      size: item.size,
      delta: -item.quantity,
      reason: "sale_website",
      refType: "order",
      refId: orderId,
      notes: "payment confirmed",
      createdBy,
      fromLocation: LOCATIONS.WEBSITE,
      toLocation: null,
    });
  }
}

async function restockWebsiteForOrder(client, orderId, createdBy) {
  const items = await loadOrderItems(client, orderId);
  for (const item of items) {
    await adjustStock(client, {
      variantId: item.variant_id,
      locationId: LOCATIONS.WEBSITE,
      size: item.size,
      delta: item.quantity,
      reason: "cancel_restock",
      refType: "order",
      refId: orderId,
      notes: "order cancelled — restock",
      createdBy,
      fromLocation: null,
      toLocation: LOCATIONS.WEBSITE,
    });
  }
}
