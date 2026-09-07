/**
 * Floor order routes (reception only)
 * -----------------------------------
 * Website order queue for packing desk — no owner analytics.
 * Mounted at /api/admin alongside the admin-only router.
 */

import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireReception } from "../middleware/auth.js";
import { auditFromReq } from "../audit.js";

const router = Router();
router.use(requireAuth, requireReception);

/** GET /api/admin/orders */
router.get("/orders", async (_req, res) => {
  const { rows } = await query(
    `SELECT o.*, u.email, u.full_name
     FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC LIMIT 100`
  );
  res.json({
    orders: rows.map((o) => ({
      ...o,
      payment_received: Boolean(o.payment_received_at),
    })),
  });
});

/** GET /api/admin/orders/pending-count */
router.get("/orders/pending-count", async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM orders
       WHERE status IN ('pending', 'awaiting_payment')`
    );
    res.json({ count: rows[0]?.count ?? 0 });
  } catch (err) {
    console.error("[admin/orders/pending-count]", err);
    res.status(500).json({ error: "Failed to count pending orders" });
  }
});

/**
 * GET /api/admin/orders/feed?since=ISO
 * Reception poll — new website orders since timestamp.
 */
router.get("/orders/feed", async (req, res) => {
  const sinceRaw = typeof req.query.since === "string" ? req.query.since : "";
  const since =
    sinceRaw && !Number.isNaN(Date.parse(sinceRaw))
      ? new Date(sinceRaw)
      : new Date(Date.now() - 15 * 60 * 1000);

  try {
    const { rows } = await query(
      `SELECT o.id, o.status, o.total_cents, o.payment_method, o.shipping_name,
              o.shipping_phone, o.shipping_city, o.shipping_state, o.created_at,
              u.email, u.full_name
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.created_at > $1
       ORDER BY o.created_at ASC
       LIMIT 50`,
      [since.toISOString()]
    );
    res.json({
      serverTime: new Date().toISOString(),
      orders: rows.map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.total_cents,
        paymentMethod: o.payment_method,
        shippingName: o.shipping_name,
        shippingPhone: o.shipping_phone,
        city: o.shipping_city,
        state: o.shipping_state,
        email: o.email,
        fullName: o.full_name,
        createdAt: o.created_at,
      })),
    });
  } catch (err) {
    console.error("[admin/orders/feed]", err);
    res.status(500).json({ error: "Failed to load order feed" });
  }
});

/** GET /api/admin/orders/:id/receipt */
router.get("/orders/:id/receipt", async (req, res) => {
  try {
    const { rows: orders } = await query(
      `SELECT o.*, u.email, u.full_name
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (!orders.length) return res.status(404).json({ error: "Order not found" });

    const o = orders[0];
    const { rows: items } = await query(
      `SELECT product_name, variant_name, size, quantity, unit_price_cents
       FROM order_items WHERE order_id = $1 ORDER BY product_name`,
      [o.id]
    );

    res.json({
      saleId: o.id,
      soldAt: o.created_at,
      total: o.total_cents,
      shippingCents: o.shipping_cents || 0,
      taxCents: o.tax_cents || 0,
      paymentMethod: o.payment_method || "card",
      paymentReceived: Boolean(o.payment_received_at),
      paymentReceivedAt: o.payment_received_at || null,
      channel: "website",
      notes: "",
      customerName: o.shipping_name || o.full_name || "",
      customerPhone: o.shipping_phone || "",
      customerAddress: [o.shipping_line1, o.shipping_line2, o.shipping_city, o.shipping_state]
        .filter(Boolean)
        .join(", "),
      items: items.map((i) => ({
        productName: i.product_name,
        productCode: null,
        colorName: i.variant_name,
        size: i.size,
        quantity: i.quantity,
        unitPrice: i.unit_price_cents,
        lineTotal: i.unit_price_cents * i.quantity,
      })),
    });
  } catch (err) {
    console.error("[admin/orders/:id/receipt]", err);
    res.status(500).json({ error: "Failed to load receipt" });
  }
});

router.patch("/orders/:id/status", async (req, res) => {
  try {
    const status = z
      .enum([
        "awaiting_payment",
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ])
      .parse(req.body.status);

    const { updateOrderStatus } = await import("../orders/order-status-service.js");
    const order = await updateOrderStatus(req.params.id, status, {
      adminUserId: req.user?.id || null,
    });
    await auditFromReq(req, "order_status_change", "order", req.params.id, { status });
    res.json({ order });
  } catch (err) {
    const code = err.status || (err.name === "ZodError" ? 400 : 500);
    if (code >= 500) console.error("[admin/orders/:id/status]", err);
    res.status(code).json({ error: err.message || "Failed to update status" });
  }
});

/**
 * PATCH /api/admin/orders/:id/payment
 * Record (or clear) real money received — independent of print / pack / ship.
 */
router.patch("/orders/:id/payment", async (req, res) => {
  try {
    const received = z.boolean().parse(req.body.received);
    const { setOrderPaymentReceived } = await import("../orders/order-payment-service.js");
    const order = await setOrderPaymentReceived(req.params.id, received, {
      adminUserId: req.user?.id || null,
    });
    await auditFromReq(req, received ? "order_mark_paid" : "order_unmark_paid", "order", req.params.id, {
      received,
    });
    res.json({
      order: {
        ...order,
        paymentReceived: Boolean(order.payment_received_at),
        paymentReceivedAt: order.payment_received_at || null,
      },
    });
  } catch (err) {
    const code = err.status || (err.name === "ZodError" ? 400 : 500);
    if (code >= 500) console.error("[admin/orders/:id/payment]", err);
    res.status(code).json({ error: err.message || "Failed to update payment" });
  }
});

/**
 * POST /api/admin/orders/:id/save-customer — upsert CRM from shipping fields
 */
router.post("/orders/:id/save-customer", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT o.*, u.email, u.full_name
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Order not found" });
    const { upsertCustomerFromOrder } = await import("../customers/customer-service.js");
    const customer = await upsertCustomerFromOrder({ query }, rows[0]);
    await auditFromReq(req, "customer_upsert_from_order", "customer", customer.id, {
      orderId: req.params.id,
    });
    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        segment: customer.segment,
        notes: customer.notes,
      },
    });
  } catch (err) {
    const code = err.status || 500;
    if (code >= 500) console.error("[admin/orders/:id/save-customer]", err);
    res.status(code).json({ error: err.message || "Failed to save customer" });
  }
});

/**
 * GET /api/admin/floor/summary — reception home (no profit / no costs).
 */
router.get("/floor/summary", async (_req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [pending, todaySales, lowStock] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS count FROM orders
         WHERE status IN ('pending', 'awaiting_payment')`
      ),
      query(
        `SELECT COUNT(*)::int AS sales,
                COALESCE(SUM(total_cents),0)::int AS total,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(quantity),0) FROM store_sale_items i WHERE i.sale_id = s.id)
                ),0)::int AS units
         FROM store_sales s
         WHERE s.sold_at >= $1`,
        [start.toISOString()]
      ),
      query(
        `SELECT COUNT(*)::int AS count
         FROM inventory_levels
         WHERE location_id = 'store' AND qty > 0 AND qty <= 3`
      ),
    ]);

    res.json({
      pendingOrders: pending.rows[0]?.count ?? 0,
      today: {
        sales: todaySales.rows[0]?.sales ?? 0,
        units: todaySales.rows[0]?.units ?? 0,
        total: todaySales.rows[0]?.total ?? 0,
      },
      lowStockStore: lowStock.rows[0]?.count ?? 0,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin/floor/summary]", err);
    res.status(500).json({ error: "Failed to load floor summary" });
  }
});

export default router;
