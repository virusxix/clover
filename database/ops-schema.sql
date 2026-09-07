-- Ops schema: multi-location inventory, store POS, ICONIC consignment, cost basis
-- Safe to re-run (IF NOT EXISTS). Apply: npm run db:ops

-- ─── Locations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_locations (
  id    VARCHAR(32) PRIMARY KEY,
  label VARCHAR(120) NOT NULL
);

INSERT INTO stock_locations (id, label) VALUES
  ('website', 'Website'),
  ('store', 'THE CLOVER Store'),
  ('iconic', 'ICONIC (partner)')
ON CONFLICT (id) DO NOTHING;

-- Cost basis for profit (MMK whole units, same as price_cents naming)
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS cost_cents INT NOT NULL DEFAULT 0 CHECK (cost_cents >= 0);

-- Product style codes e.g. SO1pljk (SO + seq + fabric + length + type)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_code VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_code
  ON products (product_code) WHERE product_code IS NOT NULL;

-- ─── Inventory levels (qty per variant × size × location) ─────
CREATE TABLE IF NOT EXISTS inventory_levels (
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id VARCHAR(32) NOT NULL REFERENCES stock_locations(id),
  size        VARCHAR(8) NOT NULL,
  qty         INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (variant_id, location_id, size)
);

CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory_levels(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_variant ON inventory_levels(variant_id);

-- ─── Movement ledger (audit trail) ────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id     UUID NOT NULL REFERENCES product_variants(id),
  size           VARCHAR(8) NOT NULL,
  qty            INT NOT NULL CHECK (qty <> 0),
  from_location  VARCHAR(32) REFERENCES stock_locations(id),
  to_location    VARCHAR(32) REFERENCES stock_locations(id),
  reason         VARCHAR(64) NOT NULL,
  ref_type       VARCHAR(32),
  ref_id         UUID,
  notes          TEXT NOT NULL DEFAULT '',
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_created ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_variant ON inventory_movements(variant_id);

-- ─── Physical store sales (POS recorded in admin) ─────────────
CREATE TABLE IF NOT EXISTS store_sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sold_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_cents  INT NOT NULL CHECK (total_cents >= 0),
  notes        TEXT NOT NULL DEFAULT '',
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE store_sales
  ADD COLUMN IF NOT EXISTS discount_cents INT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0);

CREATE TABLE IF NOT EXISTS store_sale_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id          UUID NOT NULL REFERENCES store_sales(id) ON DELETE CASCADE,
  variant_id       UUID NOT NULL REFERENCES product_variants(id),
  product_name     VARCHAR(255) NOT NULL,
  variant_name     VARCHAR(64) NOT NULL,
  size             VARCHAR(8) NOT NULL,
  quantity         INT NOT NULL CHECK (quantity > 0),
  unit_price_cents INT NOT NULL,
  unit_cost_cents  INT NOT NULL DEFAULT 0
);

ALTER TABLE store_sale_items
  ADD COLUMN IF NOT EXISTS discount_cents INT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0);

CREATE INDEX IF NOT EXISTS idx_store_sales_sold ON store_sales(sold_at DESC);

-- ─── ICONIC: stock we send (consignment) ──────────────────────
CREATE TABLE IF NOT EXISTS iconic_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transferred_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  from_location   VARCHAR(32) NOT NULL DEFAULT 'store' REFERENCES stock_locations(id),
  notes           TEXT NOT NULL DEFAULT '',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iconic_transfer_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id  UUID NOT NULL REFERENCES iconic_transfers(id) ON DELETE CASCADE,
  variant_id   UUID NOT NULL REFERENCES product_variants(id),
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(64) NOT NULL,
  size         VARCHAR(8) NOT NULL,
  qty_sent     INT NOT NULL CHECK (qty_sent > 0)
);

-- ─── ICONIC: monthly sold report they send us ─────────────────
CREATE TABLE IF NOT EXISTS iconic_sales_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month  DATE NOT NULL,
  notes         TEXT NOT NULL DEFAULT '',
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_month)
);

CREATE TABLE IF NOT EXISTS iconic_sales_report_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           UUID NOT NULL REFERENCES iconic_sales_reports(id) ON DELETE CASCADE,
  variant_id          UUID NOT NULL REFERENCES product_variants(id),
  product_name        VARCHAR(255) NOT NULL,
  variant_name        VARCHAR(64) NOT NULL,
  size                VARCHAR(8) NOT NULL,
  qty_sold            INT NOT NULL CHECK (qty_sold > 0),
  unit_revenue_cents  INT NOT NULL CHECK (unit_revenue_cents >= 0),
  unit_cost_cents     INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_iconic_reports_month ON iconic_sales_reports(report_month DESC);

-- Website order payment + phone (reception / packaging)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Categories: flare / biker pants; retire hoodies from seed (soft — keep FK if used)
INSERT INTO categories (id, label, sort_order) VALUES
  ('flare-pants', 'Flare Pants', 8),
  ('biker-pants', 'Biker Pants', 9)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

UPDATE categories SET label = 'Hoodies (retired)', sort_order = 99 WHERE id = 'hoodies';

-- Backfill website inventory from legacy JSONB stock (one-time safe upsert)
INSERT INTO inventory_levels (variant_id, location_id, size, qty)
SELECT
  v.id,
  'website',
  kv.key,
  GREATEST(0, (kv.value)::int)
FROM product_variants v
CROSS JOIN LATERAL jsonb_each_text(v.stock) AS kv
WHERE (kv.value)::int IS NOT NULL
ON CONFLICT (variant_id, location_id, size) DO NOTHING;

-- Website order status: unpaid offline payments before stock is committed
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_payment' BEFORE 'pending';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Default cost ~45% of sell price where unset (edit in admin later)
UPDATE product_variants
SET cost_cents = GREATEST(0, ROUND(price_cents * 0.45))
WHERE cost_cents = 0 AND price_cents > 0;
