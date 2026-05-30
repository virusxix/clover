/**
 * Customer orders & mock checkout
 */
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { computeOrderTotals, toDisplayAmount } from "../currency.js";
import { getEffectivePriceMmk } from "../sale-pricing.js";
import { getSaleDiscountPercent } from "../store-settings.js";

const router = Router();

const checkoutSchema = z.object({
  shipping: z.object({
    name: z.string().min(2),
    line1: z.string().min(3),
    line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    zip: z.string().min(3),
    country: z.string().length(2).default("US"),
  }),
  payment: z.object({
    cardNumber: z.string().regex(/^\d{16}$/),
    expiry: z.string().regex(/^\d{2}\/\d{2}$/),
    cvc: z.string().regex(/^\d{3,4}$/),
  }),
});

/** Mock payment — never store raw card data in production; use Stripe/PayPal */
function mockPaymentRef(cardNumber) {
  const last4 = cardNumber.slice(-4);
  return `mock_pay_${Date.now()}_${last4}`;
}

router.use(requireAuth);

router.get("/", async (req, res) => {
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
});

router.get("/:id", async (req, res) => {
  const { rows: orders } = await query(
    `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!orders.length) return res.status(404).json({ error: "Order not found" });

  const { rows: items } = await query(`SELECT * FROM order_items WHERE order_id = $1`, [
    req.params.id,
  ]);

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
      },
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
});

router.post("/checkout", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const client = await (await import("../pg-pool.js")).getPool().then((p) => p.connect());

  try {
    await client.query("BEGIN");

    const { rows: cartRows } = await client.query(
      `SELECT c.*, p.name AS product_name, p.tags, v.color_name, v.price_cents, v.stock
       FROM cart_items c
       JOIN products p ON p.id = c.product_id
       JOIN product_variants v ON v.id = c.variant_id
       WHERE c.user_id = $1`,
      [req.user.id]
    );

    if (!cartRows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cart is empty" });
    }

    for (const item of cartRows) {
      const available = item.stock?.[item.size] ?? 0;
      if (available < item.quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Insufficient stock for ${item.product_name}` });
      }
    }

    const salePercent = await getSaleDiscountPercent();
    const subtotalMmk = cartRows.reduce((s, i) => {
      const unit = getEffectivePriceMmk(i.price_cents, i.tags, salePercent);
      return s + unit * i.quantity;
    }, 0);
    const totals = computeOrderTotals(subtotalMmk);
    const subtotalCents = totals.subtotal;
    const shippingCents = totals.shipping;
    const taxCents = totals.tax;
    const totalCents = totals.total;
    const paymentRef = mockPaymentRef(parsed.data.payment.cardNumber);
    const sh = parsed.data.shipping;

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (
         user_id, status, subtotal_cents, shipping_cents, tax_cents, total_cents,
         shipping_name, shipping_line1, shipping_line2, shipping_city,
         shipping_state, shipping_zip, shipping_country, payment_ref
       ) VALUES ($1,'processing',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        req.user.id,
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        sh.name,
        sh.line1,
        sh.line2 || null,
        sh.city,
        sh.state,
        sh.zip,
        sh.country,
        paymentRef,
      ]
    );

    const orderId = orderRows[0].id;

    for (const item of cartRows) {
      const unitPriceCents = getEffectivePriceMmk(item.price_cents, item.tags, salePercent);
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
          unitPriceCents,
        ]
      );

      await client.query(
        `UPDATE product_variants
         SET stock = jsonb_set(
           stock, ARRAY[$2],
           to_jsonb(GREATEST(0, COALESCE((stock->>$2)::int, 0) - $3))
         )
         WHERE id = $1`,
        [item.variant_id, item.size, item.quantity]
      );
    }

    await client.query(`DELETE FROM cart_items WHERE user_id = $1`, [req.user.id]);
    await client.query("COMMIT");

    res.status(201).json({
      orderId,
      paymentRef,
      total: totalCents,
      message: "Order placed successfully (mock payment)",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[checkout]", err);
    res.status(500).json({ error: "Checkout failed" });
  } finally {
    client.release();
  }
});

export default router;
