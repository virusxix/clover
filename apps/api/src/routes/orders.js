/**
 * Orders HTTP routes
 * ------------------
 * One job: list / show orders and accept checkout POSTs.
 * Checkout business logic lives in checkout-service.js.
 */

import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { toDisplayAmount } from "../currency.js";
import { placeOrder } from "../checkout-service.js";

const router = Router();

const checkoutSchema = z.object({
  shipping: z.object({
    name: z.string().min(2),
    line1: z.string().min(3),
    line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    zip: z.string().min(3),
    country: z.string().length(2).default("MM"),
    phone: z.string().min(6).max(32).optional(),
  }),
  payment: z.object({
    method: z.enum(["cod", "kbzpay", "card"]),
  }),
});

router.use(requireAuth);

/** GET /api/orders — list current user's orders */
router.get("/", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, status, total_cents, created_at, updated_at
       FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({
      orders: rows.map((o) => ({
        id: o.id,
        status: o.status,
        total: toDisplayAmount(o.total_cents),
        createdAt: o.created_at,
        updatedAt: o.updated_at,
      })),
    });
  } catch (err) {
    console.error("[orders]", err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

/** GET /api/orders/:id — one order + line items (owner only) */
router.get("/:id", async (req, res) => {
  try {
    const { rows: orders } = await query(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!orders.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    const { rows: items } = await query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [req.params.id]
    );

    const o = orders[0];
    res.json({
      order: {
        id: o.id,
        status: o.status,
        subtotal: toDisplayAmount(o.subtotal_cents),
        shipping: toDisplayAmount(o.shipping_cents),
        tax: toDisplayAmount(o.tax_cents),
        total: toDisplayAmount(o.total_cents),
        shippingAddress: {
          name: o.shipping_name,
          line1: o.shipping_line1,
          line2: o.shipping_line2,
          city: o.shipping_city,
          state: o.shipping_state,
          zip: o.shipping_zip,
          country: o.shipping_country,
          phone: o.shipping_phone || null,
        },
        paymentMethod: o.payment_method || null,
        createdAt: o.created_at,
      },
      items: items.map((i) => ({
        productName: i.product_name,
        variantName: i.variant_name,
        size: i.size,
        quantity: i.quantity,
        unitPrice: toDisplayAmount(i.unit_price_cents),
      })),
    });
  } catch (err) {
    console.error("[orders/:id]", err);
    res.status(500).json({ error: "Failed to load order" });
  }
});

/** POST /api/orders/checkout — create order from cart */
router.post("/checkout", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await placeOrder({
      userId: req.user.id,
      shipping: parsed.data.shipping,
      paymentMethod: parsed.data.payment.method,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[checkout]", err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

export default router;
