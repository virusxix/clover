/**
 * Seed catalog from THE CLOVER product data (categories + products).
 * Also ensures the single default admin account exists.
 */

import bcrypt from "bcryptjs";

/** Default admin — override with ADMIN_EMAIL / ADMIN_PASSWORD in apps/api/.env */
export const DEFAULT_ADMIN = {
  email: process.env.ADMIN_EMAIL || "admin@clover.com",
  password: process.env.ADMIN_PASSWORD || "Admin123!",
  fullName: process.env.ADMIN_NAME || "Clover Admin",
};

export const CATEGORIES = [
  { id: "all", label: "All", sort_order: 0 },
  { id: "jackets", label: "Jackets", sort_order: 1 },
  { id: "long-sleeve", label: "Long Sleeve", sort_order: 2 },
  { id: "short-sleeve", label: "Short Sleeve", sort_order: 3 },
  { id: "shorts", label: "Shorts", sort_order: 4 },
  { id: "skirts", label: "Skirts", sort_order: 5 },
  { id: "leggings", label: "Leggings", sort_order: 6 },
  { id: "flare-pants", label: "Flare Pants", sort_order: 7 },
  { id: "biker-pants", label: "Biker Pants", sort_order: 8 },
  { id: "tops", label: "Tops & Bras", sort_order: 9 },
  { id: "accessories", label: "Accessories", sort_order: 10 },
];

/** Product catalog migrated from js/catalog-data.js */
export const PRODUCTS = [
  {
    slug: "ribbed-zip-jacket",
    product_code: "SO1pljk",
    name: "Ribbed Zip Jacket",
    category_id: "jackets",
    gender: "women",
    activity: "training",
    featured: true,
    tags: ["new", "featured", "ribbed", "zip"],
    description:
      "Four-way stretch zip jacket engineered for training and everyday wear. Moisture-wicking fabric with zero-distraction seams.",
    specs: { fabric: "Polyester", fit: "Athletic", care: "Machine wash cold" },
    variants: [
      { key: "black", color: "Black", hex: "#1a1a1a", price: 185000, stock: { XS: 4, S: 12, M: 18, L: 14, XL: 8 }, images: ["/assets/photo_6111774033587147108_y.jpg"] },
      { key: "espresso", color: "Espresso", hex: "#4a3228", price: 185000, stock: { XS: 4, S: 9, M: 14, L: 11, XL: 5 }, images: ["/assets/photo_6111774033587147111_y.jpg"] },
      { key: "burgundy", color: "Burgundy", hex: "#6b2d3a", price: 185000, stock: { XS: 3, S: 9, M: 12, L: 8, XL: 5 }, images: ["/assets/photo_6111774033587147110_y.jpg"] },
      { key: "navy", color: "Navy", hex: "#1e2a3a", price: 185000, stock: { XS: 4, S: 11, M: 14, L: 9, XL: 5 }, images: ["/assets/photo_6111774033587147112_y.jpg"] },
    ],
  },
  {
    slug: "front-zip-sports-bra",
    product_code: "SO2prtp",
    name: "Front Zip Sports Bra",
    category_id: "tops",
    gender: "women",
    activity: "yoga",
    featured: true,
    tags: ["new", "featured", "bra"],
    description: "Medium-support sports bra with a full front zipper and ruched bust panels.",
    specs: { support: "Medium", closure: "Front zip" },
    variants: [
      { key: "ice-blue", color: "Ice Blue", hex: "#c5d8e4", price: 90000, stock: { XS: 8, S: 14, M: 20, L: 12, XL: 6 }, images: ["/assets/hero-image.png"] },
      { key: "dusty-rose", color: "Dusty Rose", hex: "#c4a0a8", price: 90000, stock: { XS: 5, S: 10, M: 14, L: 8, XL: 4 }, images: ["/assets/photo_6111774033587147104_y.jpg"] },
    ],
  },
  {
    slug: "scoop-sports-bra",
    product_code: "SO3prtp",
    name: "Scoop Sports Bra",
    category_id: "tops",
    gender: "women",
    activity: "yoga",
    featured: true,
    tags: ["sale", "bra"],
    description: "Pull-on scoop-neck sports bra with Y-back straps.",
    specs: { support: "Light" },
    variants: [
      { key: "black", color: "Black", hex: "#1a1a1a", price: 72000, stock: { XS: 8, S: 15, M: 22, L: 14, XL: 7 }, images: ["/assets/photo_6111774033587147088_y.png"] },
      { key: "caramel", color: "Caramel", hex: "#c49a6c", price: 72000, stock: { XS: 6, S: 12, M: 18, L: 11, XL: 5 }, images: ["/assets/photo_6111774033587147089_y.png"] },
    ],
  },
  {
    slug: "contour-training-tee",
    product_code: "SO4psss",
    name: "Contour Training Tee",
    category_id: "short-sleeve",
    gender: "women",
    activity: "gym",
    featured: true,
    tags: ["tee"],
    description: "Fitted short-sleeve performance tee with princess seams.",
    specs: { fabric: "Performance knit" },
    variants: [
      { key: "charcoal", color: "Charcoal", hex: "#6b7280", price: 68000, stock: { XS: 6, S: 14, M: 20, L: 15, XL: 8 }, images: ["/assets/photo_6111774033587147092_y.png"] },
      { key: "mint", color: "Mint", hex: "#b8d4c8", price: 68000, stock: { XS: 5, S: 12, M: 18, L: 12, XL: 6 }, images: ["/assets/photo_6111774033587147091_y.png"] },
    ],
  },
  {
    slug: "flare-compression-legging",
    product_code: "SO5pllg",
    name: "Flare Compression Legging",
    category_id: "leggings",
    gender: "women",
    activity: "yoga",
    featured: true,
    tags: ["new"],
    description: "High-rise flare legging with four-way stretch.",
    specs: { rise: "High" },
    variants: [
      { key: "espresso", color: "Espresso", hex: "#4a3228", price: 110000, stock: { XS: 4, S: 10, M: 16, L: 12, XL: 6 }, images: ["/assets/photo_6111774033587147116_y.jpg"] },
      { key: "black", color: "Black", hex: "#111827", price: 110000, stock: { XS: 6, S: 14, M: 22, L: 16, XL: 10 }, images: ["/assets/photo_6111774033587147117_y.jpg"] },
    ],
  },
];

/**
 * Ensure the one default admin exists.
 * Creates with the default password if missing; promotes existing email to admin
 * without overwriting a password they already set.
 * Demotes any other admins so only this account stays admin.
 */
export async function ensureDefaultAdmin(query) {
  const isProd = process.env.NODE_ENV === "production";
  const usingDefaultPassword =
    !process.env.ADMIN_PASSWORD && DEFAULT_ADMIN.password === "Admin123!";

  if (isProd && usingDefaultPassword) {
    console.warn(
      "[seed] Refusing default Admin123! in production — set ADMIN_PASSWORD before seeding admin."
    );
    return;
  }

  const email = DEFAULT_ADMIN.email.toLowerCase().trim();
  const hash = await bcrypt.hash(DEFAULT_ADMIN.password, 12);

  await query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin'::user_role)
     ON CONFLICT (email) DO UPDATE SET
       role = 'admin'::user_role,
       full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), users.full_name)`,
    [email, hash, DEFAULT_ADMIN.fullName]
  );

  // Keep a single admin: demote anyone else with role=admin
  const { rowCount } = await query(
    `UPDATE users SET role = 'customer'::user_role
     WHERE role = 'admin'::user_role AND email <> $1`,
    [email]
  );

  console.log(
    `[seed] Default admin ready: ${email}` +
      (rowCount ? ` (demoted ${rowCount} other admin account(s))` : "")
  );
}

export async function runSeed(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      sale_discount_percent INT NOT NULL DEFAULT 20
        CHECK (sale_discount_percent >= 1 AND sale_discount_percent <= 90)
    )
  `);
  await query(
    `INSERT INTO app_settings (id, sale_discount_percent) VALUES (1, 20) ON CONFLICT (id) DO NOTHING`
  );

  await ensureDefaultAdmin(query);

  for (const c of CATEGORIES.filter((x) => x.id !== "all")) {
    await query(
      `INSERT INTO categories (id, label, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [c.id, c.label, c.sort_order]
    );
  }

  for (const p of PRODUCTS) {
    const { rows } = await query(
      `INSERT INTO products (slug, product_code, name, description, category_id, gender, activity, featured, tags, specs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         tags = EXCLUDED.tags,
         featured = EXCLUDED.featured,
         product_code = COALESCE(EXCLUDED.product_code, products.product_code)
       RETURNING id`,
      [
        p.slug,
        p.product_code || null,
        p.name,
        p.description,
        p.category_id,
        p.gender,
        p.activity,
        p.featured,
        p.tags,
        p.specs,
      ]
    );
    const productId = rows[0].id;

    for (const v of p.variants) {
      const { rows: vr } = await query(
        `INSERT INTO product_variants (product_id, variant_key, color_name, color_hex, price_cents, stock)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (product_id, variant_key) DO UPDATE SET stock = EXCLUDED.stock, price_cents = EXCLUDED.price_cents
         RETURNING id`,
        [productId, v.key, v.color, v.hex, Math.round(v.price), v.stock]
      );
      const variantId = vr[0].id;
      await query(`DELETE FROM product_images WHERE variant_id = $1`, [variantId]);
      for (let i = 0; i < v.images.length; i++) {
        await query(
          `INSERT INTO product_images (variant_id, url, alt_text, sort_order) VALUES ($1,$2,$3,$4)`,
          [variantId, v.images[i], `${p.name} — ${v.color}`, i]
        );
      }
    }
  }

  console.log("[seed] Catalog seeded.");
}
