import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { resolvePricing } from "../sale-pricing.js";
import { getSaleDiscountPercent } from "../store-settings.js";
import { preferWebpUrl } from "../media-url.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.quantity, c.size,
            p.id AS product_id, p.slug, p.name, p.tags,
            v.id AS variant_id, v.color_name, v.price_cents,
            (SELECT url FROM product_images WHERE variant_id = v.id ORDER BY sort_order LIMIT 1) AS image_url
     FROM cart_items c
     JOIN products p ON p.id = c.product_id
     JOIN product_variants v ON v.id = c.variant_id
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC`,
    [req.user.id]
  );

  const salePercent = await getSaleDiscountPercent();

  res.json({
    items: rows.map((r) => {
      const pricing = resolvePricing(r.price_cents, r.tags, salePercent);
      return {
        id: r.id,
        quantity: r.quantity,
        size: r.size,
        productId: r.product_id,
        slug: r.slug,
        name: r.name,
        variantId: r.variant_id,
        colorName: r.color_name,
        price: pricing.price,
        compareAtPrice: pricing.compareAtPrice,
        onSale: pricing.onSale,
        discountPercent: pricing.discountPercent,
        imageUrl: preferWebpUrl(r.image_url),
        lineTotal: pricing.price * r.quantity,
      };
    }),
    subtotal: rows.reduce((s, r) => {
      const pricing = resolvePricing(r.price_cents, r.tags, salePercent);
      return s + pricing.price * r.quantity;
    }, 0),
  });
});

router.post("/", async (req, res) => {
  const schema = z.object({
    variantId: z.string().uuid(),
    size: z.string().max(8),
    quantity: z.number().int().min(1).max(10).default(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { variantId, size, quantity } = parsed.data;

  const { rows: variants } = await query(
    `SELECT v.*, p.id AS product_id FROM product_variants v
     JOIN products p ON p.id = v.product_id WHERE v.id = $1`,
    [variantId]
  );
  if (!variants.length) return res.status(404).json({ error: "Variant not found" });

  const stock = variants[0].stock?.[size] ?? 0;
  if (stock < quantity) return res.status(400).json({ error: "Insufficient stock" });

  const { rows } = await query(
    `INSERT INTO cart_items (user_id, product_id, variant_id, size, quantity)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, variant_id, size)
     DO UPDATE SET quantity = LEAST(cart_items.quantity + $5, 10)
     RETURNING *`,
    [req.user.id, variants[0].product_id, variantId, size, quantity]
  );

  res.status(201).json({ item: rows[0] });
});

router.patch("/:id", async (req, res) => {
  const quantity = parseInt(req.body.quantity, 10);
  if (!quantity || quantity < 1 || quantity > 10) {
    return res.status(400).json({ error: "Quantity must be 1–10" });
  }
  await query(
    `UPDATE cart_items SET quantity = $3 WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id, quantity]
  );
  res.json({ ok: true });
});

router.delete("/:id", async (req, res) => {
  await query(`DELETE FROM cart_items WHERE id = $1 AND user_id = $2`, [
    req.params.id,
    req.user.id,
  ]);
  res.json({ ok: true });
});

export default router;
