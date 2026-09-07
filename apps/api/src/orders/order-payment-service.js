/**
 * Order payment received (independent of pack / ship)
 * ---------------------------------------------------
 * Print & delivery can happen before cash/KBZ lands.
 * Marking paid records real money; for awaiting_payment it also commits stock.
 */

import { getPool } from "../pg-pool.js";
import { LOCATIONS } from "../inventory/locations.js";
import { adjustStock } from "../inventory/stock-service.js";

/**
 * @param {string} orderId
 * @param {boolean} received
 * @param {{ adminUserId?: string|null }} [opts]
 */
export async function setOrderPaymentReceived(orderId, received, opts = {}) {
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

    if (!received) {
      if (!order.payment_received_at) {
        await client.query("COMMIT");
        return order;
      }
      const { rows: updated } = await client.query(
        `UPDATE orders SET payment_received_at = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [orderId]
      );
      await client.query("COMMIT");
      return updated[0];
    }

    if (order.payment_received_at) {
      await client.query("COMMIT");
      return order;
    }

    // First time money is confirmed for an unpaid online order → hold website stock.
    if (order.status === "awaiting_payment") {
      await commitWebsiteStockForOrder(client, orderId, opts.adminUserId || null);
      const { rows: updated } = await client.query(
        `UPDATE orders
         SET payment_received_at = NOW(),
             status = 'pending',
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [orderId]
      );
      await client.query("COMMIT");
      return updated[0];
    }

    const { rows: updated } = await client.query(
      `UPDATE orders SET payment_received_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [orderId]
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

async function commitWebsiteStockForOrder(client, orderId, createdBy) {
  const { rows: items } = await client.query(
    `SELECT variant_id, size, quantity FROM order_items WHERE order_id = $1`,
    [orderId]
  );
  for (const item of items) {
    await adjustStock(client, {
      variantId: item.variant_id,
      locationId: LOCATIONS.WEBSITE,
      size: item.size,
      delta: -item.quantity,
      reason: "sale_website",
      refType: "order",
      refId: orderId,
      notes: "payment received",
      createdBy,
      fromLocation: LOCATIONS.WEBSITE,
      toLocation: null,
    });
  }
}
