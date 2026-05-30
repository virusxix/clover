/**
 * Public product catalog with filtering
 */
import { Router } from "express";
import { query } from "../db.js";
import { resolvePricing } from "../sale-pricing.js";
import { getSaleDiscountPercent } from "../store-settings.js";

const router = Router();

/** GET /api/products — filterable catalog */
router.get("/", async (req, res) => {
  const {
    category,
    gender,
    activity,
    color,
    size,
    minPrice,
    maxPrice,
    featured,
    new: newArrivals,
    sale,
    q,
    page = "1",
    limit = "24",
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(48, Math.max(1, parseInt(limit, 10) || 24));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ["1=1"];
  const params = [];
  let idx = 1;

  if (category && category !== "all") {
    conditions.push(`p.category_id = $${idx++}`);
    params.push(category);
  }
  if (gender) {
    conditions.push(`p.gender = $${idx++}`);
    params.push(gender);
  }
  if (activity) {
    conditions.push(`p.activity = $${idx++}`);
    params.push(activity);
  }
  if (featured === "true") {
    conditions.push(`p.featured = TRUE`);
  }
  if (newArrivals === "true") {
    conditions.push(`'new' = ANY(p.tags)`);
  }
  if (sale === "true") {
    conditions.push(`'sale' = ANY(p.tags)`);
  }
  if (q) {
    conditions.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (minPrice) {
    conditions.push(`v.price_cents >= $${idx++}`);
    params.push(parseInt(minPrice, 10));
  }
  if (maxPrice) {
    conditions.push(`v.price_cents <= $${idx++}`);
    params.push(parseInt(maxPrice, 10));
  }
  if (color) {
    conditions.push(`v.color_name ILIKE $${idx++}`);
    params.push(color);
  }
  if (size) {
    conditions.push(`(v.stock->>$${idx})::int > 0`);
    params.push(size);
    idx++;
  }

  const where = conditions.join(" AND ");

  try {
    const countSql = `
      SELECT COUNT(DISTINCT p.id)::int AS total
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
      WHERE ${where}`;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0].total;

    const sql = `
      SELECT DISTINCT ON (p.id)
        p.id, p.slug, p.name, p.description, p.category_id, p.gender, p.activity,
        p.featured, p.tags, p.specs,
        v.id AS variant_id, v.color_name, v.color_hex, v.price_cents,
        (SELECT url FROM product_images pi
         WHERE pi.variant_id = v.id ORDER BY sort_order LIMIT 1) AS image_url
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
      WHERE ${where}
      ORDER BY p.id, v.price_cents
      LIMIT $${idx++} OFFSET $${idx++}`;

    const { rows } = await query(sql, [...params, limitNum, offset]);
    const salePercent = await getSaleDiscountPercent();

    let products = rows.map((r) => mapProductListItem(r, salePercent));
    if (newArrivals === "true") {
      const { rows: dated } = await query(
        `SELECT id, created_at FROM products WHERE id = ANY($1::uuid[])`,
        [products.map((p) => p.id)]
      );
      const dates = Object.fromEntries(dated.map((r) => [r.id, r.created_at]));
      products = products.sort(
        (a, b) => new Date(dates[b.id] || 0).getTime() - new Date(dates[a.id] || 0).getTime()
      );
    }

    res.json({
      products,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error("[products]", err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

/** GET /api/products/meta/categories — must be before :slug */
router.get("/meta/categories", async (_req, res) => {
  const { rows } = await query(`SELECT * FROM categories ORDER BY sort_order`);
  res.json({ categories: rows });
});

/** GET /api/products/:slug */
router.get("/:slug", async (req, res) => {
  try {
    const { rows: products } = await query(
      `SELECT * FROM products WHERE slug = $1`,
      [req.params.slug]
    );
    if (!products.length) return res.status(404).json({ error: "Product not found" });

    const product = products[0];
    const { rows: variants } = await query(
      `SELECT * FROM product_variants WHERE product_id = $1 ORDER BY price_cents`,
      [product.id]
    );

    const variantIds = variants.map((v) => v.id);
    let images = [];
    if (variantIds.length) {
      const { rows: imgs } = await query(
        `SELECT * FROM product_images WHERE variant_id = ANY($1) ORDER BY sort_order`,
        [variantIds]
      );
      images = imgs;
    }

    const { rows: categories } = await query(`SELECT * FROM categories ORDER BY sort_order`);
    const salePercent = await getSaleDiscountPercent();

    res.json({
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        categoryId: product.category_id,
        gender: product.gender,
        activity: product.activity,
        featured: product.featured,
        tags: product.tags,
        specs: product.specs,
      },
      variants: variants.map((v) => {
        const pricing = resolvePricing(v.price_cents, product.tags, salePercent);
        return {
          id: v.id,
          key: v.variant_key,
          colorName: v.color_name,
          colorHex: v.color_hex,
          price: pricing.price,
          compareAtPrice: pricing.compareAtPrice,
          onSale: pricing.onSale,
          discountPercent: pricing.discountPercent,
          stock: v.stock,
          images: images
            .filter((i) => i.variant_id === v.id)
            .map((i) => ({ url: i.url, alt: i.alt_text })),
        };
      }),
      categories,
    });
  } catch (err) {
    console.error("[product detail]", err);
    res.status(500).json({ error: "Failed to load product" });
  }
});

function mapProductListItem(row, saleDiscountPercent) {
  const pricing = resolvePricing(row.price_cents, row.tags, saleDiscountPercent);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    gender: row.gender,
    activity: row.activity,
    featured: row.featured,
    tags: row.tags,
    variantId: row.variant_id,
    colorName: row.color_name,
    colorHex: row.color_hex,
    price: pricing.price,
    compareAtPrice: pricing.compareAtPrice,
    onSale: pricing.onSale,
    discountPercent: pricing.discountPercent,
    imageUrl: row.image_url,
  };
}

export default router;
