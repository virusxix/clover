/**
 * Admin: dashboard metrics, products CRUD, orders, users
 */
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { toDisplayAmount, toStoredAmount } from "../currency.js";
import { getSaleDiscountPercent, setSaleDiscountPercent } from "../store-settings.js";
import {
  FABRICS,
  LENGTHS,
  TYPES,
  CATEGORY_DEFAULTS,
  nextProductSeq,
  resolveProductCode,
  describeProductCode,
} from "../catalog/product-code.js";

const router = Router();
router.use(requireAuth, requireAdmin);

/** GET /api/admin/product-codes/meta — legend + next sequence for the builder */
router.get("/product-codes/meta", async (_req, res) => {
  const nextSeq = await nextProductSeq(query);
  res.json({
    prefix: "SO",
    example: "SO1pljk",
    nextSeq,
    fabrics: FABRICS,
    lengths: LENGTHS,
    types: TYPES,
    categoryDefaults: CATEGORY_DEFAULTS,
  });
});

/** GET /api/admin/settings */
router.get("/settings", async (_req, res) => {
  const saleDiscountPercent = await getSaleDiscountPercent();
  res.json({ saleDiscountPercent });
});

/** PATCH /api/admin/settings */
router.patch("/settings", async (req, res) => {
  const parsed = z
    .object({
      saleDiscountPercent: z.number().int().min(1).max(90),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const saleDiscountPercent = await setSaleDiscountPercent(parsed.data.saleDiscountPercent);
  res.json({ saleDiscountPercent });
});

/** GET /api/admin/dashboard */
router.get("/dashboard", async (_req, res) => {
  const [sales, users, topProducts, recentOrders] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_cents),0)::int AS total FROM orders WHERE status != 'cancelled'`),
    query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'customer'`),
    query(
      `SELECT oi.product_name, SUM(oi.quantity)::int AS units, SUM(oi.quantity * oi.unit_price_cents)::int AS revenue
       FROM order_items oi GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 5`
    ),
    query(
      `SELECT o.id, o.status, o.total_cents, u.email, o.created_at
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT 8`
    ),
  ]);

  res.json({
    totalSales: toDisplayAmount(sales.rows[0].total),
    activeUsers: users.rows[0].count,
    topProducts: topProducts.rows.map((r) => ({
      name: r.product_name,
      units: r.units,
      revenue: toDisplayAmount(r.revenue),
    })),
    recentOrders: recentOrders.rows.map((o) => ({
      id: o.id,
      status: o.status,
      total: toDisplayAmount(o.total_cents),
      email: o.email,
      createdAt: o.created_at,
    })),
  });
});

const SIZES = ["XS", "S", "M", "L", "XL"];

function buildTags({ tagNew, tagSale, tags = [] }) {
  const set = new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean));
  if (tagNew) set.add("new");
  else set.delete("new");
  if (tagSale) set.add("sale");
  else set.delete("sale");
  return [...set];
}

function normalizeStock(stock) {
  if (!stock || typeof stock !== "object") return {};
  const out = {};
  for (const size of SIZES) {
    const n = parseInt(stock[size], 10);
    if (!Number.isNaN(n) && n >= 0) out[size] = n;
  }
  return out;
}

/** GET /api/admin/products */
router.get("/products", async (_req, res) => {
  const { rows } = await query(
    `SELECT p.*,
       COALESCE(
         json_agg(
           json_build_object(
             'id', v.id,
             'variant_key', v.variant_key,
             'color_name', v.color_name,
             'color_hex', v.color_hex,
             'price_cents', v.price_cents,
             'stock', v.stock,
             'image_url', (
               SELECT url FROM product_images pi
               WHERE pi.variant_id = v.id ORDER BY pi.sort_order LIMIT 1
             )
           )
           ORDER BY v.variant_key
         ) FILTER (WHERE v.id IS NOT NULL),
         '[]'
       ) AS variants
     FROM products p
     LEFT JOIN product_variants v ON v.product_id = p.id
     GROUP BY p.id ORDER BY p.created_at DESC`
  );
  res.json({
    products: rows.map((p) => ({
      ...p,
      variants: typeof p.variants === "string" ? JSON.parse(p.variants) : p.variants || [],
    })),
  });
});

/** GET /api/admin/products/:id */
router.get("/products/:id", async (req, res) => {
  const { rows } = await query(`SELECT * FROM products WHERE id = $1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  const { rows: variants } = await query(
    `SELECT v.*,
       COALESCE(
         (SELECT json_agg(json_build_object('url', pi.url, 'alt', pi.alt_text) ORDER BY pi.sort_order)
          FROM product_images pi WHERE pi.variant_id = v.id),
         '[]'
       ) AS images
     FROM product_variants v WHERE v.product_id = $1 ORDER BY v.variant_key`,
    [req.params.id]
  );
  res.json({ product: rows[0], variants });
});

const productSchema = z.object({
  slug: z.string().min(2).max(120),
  name: z.string().min(2),
  description: z.string().default(""),
  categoryId: z.string().optional(),
  gender: z.enum(["men", "women", "unisex"]).default("women"),
  activity: z.enum(["yoga", "gym", "running", "training", "lifestyle"]).default("training"),
  featured: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  specs: z.record(z.unknown()).default({}),
  productCode: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/, "Use letters, numbers, -, _, or .")
    .optional(),
  fabric: z.string().length(1).optional(),
  length: z.string().length(1).optional(),
  type: z.string().min(2).max(4).optional(),
  seq: z.number().int().positive().optional(),
});

const createWithVariantSchema = productSchema.extend({
  productCode: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/, "Use letters, numbers, -, _, or ."),
  tagNew: z.boolean().optional(),
  tagSale: z.boolean().optional(),
  price: z.number().positive(),
  colorName: z.string().min(1),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#1a1a1a"),
  imageUrl: z.string().optional(),
  stock: z.record(z.union([z.number(), z.string()])).default({}),
});

router.post("/products", async (req, res) => {
  const parsed = createWithVariantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const customTags = (d.tags || []).filter((t) => !["new", "sale"].includes(String(t).toLowerCase()));
  const tags = buildTags({ tagNew: d.tagNew, tagSale: d.tagSale, tags: customTags });
  const stock = normalizeStock(d.stock);
  const variantKey = d.colorName.toLowerCase().replace(/\s+/g, "-").slice(0, 64);

  let productCode;
  try {
    productCode = await resolveProductCode(
      {
        productCode: d.productCode,
        fabric: d.fabric,
        length: d.length,
        type: d.type,
        categoryId: d.categoryId,
        seq: d.seq,
      },
      query
    );
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Invalid product code" });
  }

  try {
    const { rows } = await query(
      `INSERT INTO products (slug, product_code, name, description, category_id, gender, activity, featured, tags, specs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        d.slug,
        productCode,
        d.name,
        d.description,
        d.categoryId || null,
        d.gender,
        d.activity,
        d.featured,
        tags,
        d.specs,
      ]
    );
    const product = rows[0];

    const { rows: vrows } = await query(
      `INSERT INTO product_variants (product_id, variant_key, color_name, color_hex, price_cents, stock)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [product.id, variantKey, d.colorName, d.colorHex, toStoredAmount(d.price), stock]
    );

    if (d.imageUrl) {
      await query(
        `INSERT INTO product_images (variant_id, url, alt_text, sort_order) VALUES ($1,$2,$3,0)`,
        [vrows[0].id, d.imageUrl, d.name]
      );
    }

    res.status(201).json({
      product,
      variant: vrows[0],
      productCodeLabel: describeProductCode(productCode),
    });
  } catch (err) {
    if (err && err.code === "23505") {
      return res.status(409).json({ error: "Slug or product code already exists" });
    }
    throw err;
  }
});

const updateProductSchema = productSchema.partial().extend({
  tagNew: z.boolean().optional(),
  tagSale: z.boolean().optional(),
});

router.patch("/products/:id", async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const { rows: existing } = await query(`SELECT tags FROM products WHERE id = $1`, [req.params.id]);
  if (!existing.length) return res.status(404).json({ error: "Not found" });

  let tags;
  if (d.tagNew !== undefined || d.tagSale !== undefined || d.tags) {
    const base = (d.tags ?? existing[0].tags ?? []).filter(
      (t) => !["new", "sale"].includes(String(t).toLowerCase())
    );
    tags = buildTags({
      tagNew: d.tagNew ?? existing[0].tags?.includes("new"),
      tagSale: d.tagSale ?? existing[0].tags?.includes("sale"),
      tags: base,
    });
  }

  let productCode = null;
  const wantsCode =
    d.productCode != null ||
    d.fabric != null ||
    d.length != null ||
    d.type != null ||
    d.seq != null;
  if (wantsCode) {
    try {
      productCode = await resolveProductCode(
        {
          productCode: d.productCode,
          fabric: d.fabric,
          length: d.length,
          type: d.type,
          categoryId: d.categoryId,
          seq: d.seq,
        },
        query
      );
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Invalid product code" });
    }
  }

  try {
    const { rows } = await query(
      `UPDATE products SET
         slug = COALESCE($2, slug),
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         category_id = COALESCE($5, category_id),
         gender = COALESCE($6, gender),
         activity = COALESCE($7, activity),
         featured = COALESCE($8, featured),
         tags = COALESCE($9, tags),
         specs = COALESCE($10, specs),
         product_code = COALESCE($11, product_code)
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        d.slug,
        d.name,
        d.description,
        d.categoryId,
        d.gender,
        d.activity,
        d.featured,
        tags,
        d.specs ? JSON.stringify(d.specs) : null,
        productCode,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ product: rows[0], productCodeLabel: describeProductCode(rows[0].product_code) });
  } catch (err) {
    if (err && err.code === "23505") {
      return res.status(409).json({ error: "Slug or product code already exists" });
    }
    throw err;
  }
});

router.delete("/products/:id", async (req, res) => {
  await query(`DELETE FROM products WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

const variantSchema = z.object({
  variantKey: z.string(),
  colorName: z.string(),
  colorHex: z.string(),
  price: z.number().positive(),
  stock: z.record(z.number()),
  images: z.array(z.object({ url: z.string(), alt: z.string().optional() })).default([]),
});

router.patch("/products/:productId/variants/:variantId", async (req, res) => {
  const parsed = variantSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const stock = d.stock ? normalizeStock(d.stock) : null;

  const { rows } = await query(
    `UPDATE product_variants SET
       color_name = COALESCE($3, color_name),
       color_hex = COALESCE($4, color_hex),
       price_cents = COALESCE($5, price_cents),
       stock = COALESCE($6, stock)
     WHERE id = $2 AND product_id = $1 RETURNING *`,
    [
      req.params.productId,
      req.params.variantId,
      d.colorName,
      d.colorHex,
      d.price != null ? toStoredAmount(d.price) : null,
      stock,
    ]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });

  if (d.images?.length) {
    await query(`DELETE FROM product_images WHERE variant_id = $1`, [req.params.variantId]);
    for (let i = 0; i < d.images.length; i++) {
      await query(
        `INSERT INTO product_images (variant_id, url, alt_text, sort_order) VALUES ($1,$2,$3,$4)`,
        [req.params.variantId, d.images[i].url, d.images[i].alt || "", i]
      );
    }
  } else if (req.body.imageUrl) {
    await query(`DELETE FROM product_images WHERE variant_id = $1`, [req.params.variantId]);
    await query(
      `INSERT INTO product_images (variant_id, url, alt_text, sort_order) VALUES ($1,$2,'',0)`,
      [req.params.variantId, req.body.imageUrl]
    );
  }

  res.json({ variant: rows[0] });
});

router.post("/products/:id/variants", async (req, res) => {
  const parsed = variantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const { rows } = await query(
    `INSERT INTO product_variants (product_id, variant_key, color_name, color_hex, price_cents, stock)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.id, d.variantKey, d.colorName, d.colorHex, toStoredAmount(d.price), d.stock]
  );

  for (let i = 0; i < d.images.length; i++) {
    await query(
      `INSERT INTO product_images (variant_id, url, alt_text, sort_order) VALUES ($1,$2,$3,$4)`,
      [rows[0].id, d.images[i].url, d.images[i].alt || "", i]
    );
  }

  res.status(201).json({ variant: rows[0] });
});

/** GET /api/admin/orders */
router.get("/orders", async (_req, res) => {
  const { rows } = await query(
    `SELECT o.*, u.email, u.full_name
     FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC LIMIT 100`
  );
  res.json({ orders: rows });
});

/**
 * GET /api/admin/orders/feed?since=ISO
 * Reception poll — new website orders since timestamp (default last 15 min).
 */
router.get("/orders/feed", async (req, res) => {
  const sinceRaw = typeof req.query.since === "string" ? req.query.since : "";
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw))
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

/**
 * GET /api/admin/orders/:id/receipt — print-ready payload for XP-80C
 */
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
  const status = z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).parse(
    req.body.status
  );
  const { rows } = await query(
    `UPDATE orders SET status = $2 WHERE id = $1 RETURNING *`,
    [req.params.id, status]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json({ order: rows[0] });
});

/** GET /api/admin/users */
router.get("/users", async (_req, res) => {
  const { rows } = await query(
    `SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC`
  );
  res.json({ users: rows });
});

export default router;
