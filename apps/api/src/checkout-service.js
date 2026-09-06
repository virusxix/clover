/**
 * Checkout service
 * ----------------
 * Place an order from the cart.
 * COD: status pending + deduct WEBSITE stock immediately.
 * KBZPay/card: status awaiting_payment — stock commits when admin confirms payment.
 */

import crypto from "crypto";
import { getPool } from "./pg-pool.js";
import { computeOrderTotals } from "./currency.js";
import { getEffectivePriceMmk } from "./sale-pricing.js";
import { getSaleDiscountPercent } from "./store-settings.js";
import { LOCATIONS } from "./inventory/locations.js";
import { adjustStock, getQty } from "./inventory/stock-service.js";
import { WEB_PAYMENT_METHODS, isMandalayArea } from "./payments.js";

export function createPaymentRef(method) {
  return `${method}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

/**
 * @param {{ userId: string, shipping: object, paymentMethod: string }}
 */
export async function placeOrder({ userId, shipping, paymentMethod }) {
  if (!WEB_PAYMENT_METHODS.includes(paymentMethod)) {
    throw clientError(400, "Invalid payment method");
  }
  if (paymentMethod === "cod" && !isMandalayArea(shipping.city, shipping.state)) {
    throw clientError(
      400,
      "Cash on delivery is only available for Mandalay area addresses"
    );
  }

  // Offline methods do not hold stock until reception confirms payment.
  const commitStockNow = paymentMethod === "cod";
  const orderStatus = commitStockNow ? "pending" : "awaiting_payment";

  const client = await getPool().then((p) => p.connect());

  try {
    await client.query("BEGIN");

    const cartRows = await loadCart(client, userId);
    if (!cartRows.length) {
      await client.query("ROLLBACK");
      throw clientError(400, "Cart is empty");
    }

    await assertWebsiteStock(client, cartRows);

    const salePercent = await getSaleDiscountPercent();
    const totals = buildTotals(cartRows, salePercent);
    const paymentRef = createPaymentRef(paymentMethod);
    const orderId = await insertOrder(client, {
      userId,
      shipping,
      totals,
      paymentRef,
      paymentMethod,
      status: orderStatus,
    });

    await insertOrderItems(client, orderId, cartRows, salePercent);

    if (commitStockNow) {
      await decrementWebsiteStock(client, orderId, cartRows);
    }

    await client.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
    await client.query("COMMIT");

    return {
      orderId,
      paymentRef,
      paymentMethod,
      status: orderStatus,
      total: totals.total,
      message:
        paymentMethod === "cod"
          ? "Order placed — pay cash on delivery"
          : "Order placed — awaiting payment confirmation",
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function loadCart(client, userId) {
  const { rows } = await client.query(
    `SELECT c.*, p.name AS product_name, p.tags, v.color_name, v.price_cents
     FROM cart_items c
     JOIN products p ON p.id = c.product_id
     JOIN product_variants v ON v.id = c.variant_id
     WHERE c.user_id = $1
     FOR UPDATE OF c`,
    [userId]
  );
  return rows;
}

async function assertWebsiteStock(client, cartRows) {
  for (const item of cartRows) {
    const available = await getQty(client, {
      variantId: item.variant_id,
      locationId: LOCATIONS.WEBSITE,
      size: item.size,
    });
    if (available < item.quantity) {
      throw clientError(400, `Insufficient stock for ${item.product_name}`);
    }
  }
}

function buildTotals(cartRows, salePercent) {
  const subtotalMmk = cartRows.reduce((sum, item) => {
    const unit = getEffectivePriceMmk(item.price_cents, item.tags, salePercent);
    return sum + unit * item.quantity;
  }, 0);
  return computeOrderTotals(subtotalMmk);
}

async function insertOrder(client, { userId, shipping, totals, paymentRef, paymentMethod, status }) {
  const sh = shipping;
  const { rows } = await client.query(
    `INSERT INTO orders (
       user_id, status, subtotal_cents, shipping_cents, tax_cents, total_cents,
       shipping_name, shipping_line1, shipping_line2, shipping_city,
       shipping_state, shipping_zip, shipping_country, payment_ref,
       payment_method, shipping_phone
     ) VALUES ($1,$2::order_status,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
    [
      userId,
      status,
      totals.subtotal,
      totals.shipping,
      totals.tax,
      totals.total,
      sh.name,
      sh.line1,
      sh.line2 || null,
      sh.city,
      sh.state,
      sh.zip || "",
      sh.country,
      paymentRef,
      paymentMethod,
      sh.phone || null,
    ]
  );
  return rows[0].id;
}

async function insertOrderItems(client, orderId, cartRows, salePercent) {
  for (const item of cartRows) {
    const unitPrice = getEffectivePriceMmk(item.price_cents, item.tags, salePercent);

    await client.query(
      `INSERT INTO order_items (
         order_id, product_id, variant_id, product_name, variant_name,
         size, quantity, unit_price_cents
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        orderId,
        item.product_id,
        item.variant_id,
        item.product_name,
        item.color_name,
        item.size,
        item.quantity,
        unitPrice,
      ]
    );
  }
}

async function decrementWebsiteStock(client, orderId, cartRows) {
  for (const item of cartRows) {
    await adjustStock(client, {
      variantId: item.variant_id,
      locationId: LOCATIONS.WEBSITE,
      size: item.size,
      delta: -item.quantity,
      reason: "sale_website",
      refType: "order",
      refId: orderId,
      fromLocation: LOCATIONS.WEBSITE,
      toLocation: null,
    });
  }
}

function clientError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
