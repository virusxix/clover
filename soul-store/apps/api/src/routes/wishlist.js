import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { rows } = await query(
    `SELECT w.product_id, p.slug, p.name,
            v.price_cents, v.color_name,
            (SELECT url FROM product_images pi
             JOIN product_variants pv ON pv.id = pi.variant_id
             WHERE pv.product_id = p.id ORDER BY sort_order LIMIT 1) AS image_url
     FROM wishlist_items w
     JOIN products p ON p.id = w.product_id
     LEFT JOIN LATERAL (
       SELECT * FROM product_variants WHERE product_id = p.id LIMIT 1
     ) v ON TRUE
     WHERE w.user_id = $1`,
    [req.user.id]
  );
  res.json({ items: rows });
});

router.post("/:productId", async (req, res) => {
  await query(
    `INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [req.user.id, req.params.productId]
  );
  res.status(201).json({ ok: true });
});

router.delete("/:productId", async (req, res) => {
  await query(`DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2`, [
    req.user.id,
    req.params.productId,
  ]);
  res.json({ ok: true });
});

export default router;
