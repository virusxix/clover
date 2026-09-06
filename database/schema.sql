-- SOUL Sportswear — PostgreSQL schema
-- Run: npm run db:schema (requires DATABASE_URL)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('customer', 'admin');
CREATE TYPE gender_category AS ENUM ('men', 'women', 'unisex');
CREATE TYPE activity_type AS ENUM ('yoga', 'gym', 'running', 'training', 'lifestyle');
CREATE TYPE order_status AS ENUM (
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
);

-- ─── Users & auth ─────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  role          user_role NOT NULL DEFAULT 'customer',
  phone         VARCHAR(32),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ─── Catalog ──────────────────────────────────────────────────
CREATE TABLE categories (
  id         VARCHAR(64) PRIMARY KEY,
  label      VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(120) NOT NULL UNIQUE,
  product_code  VARCHAR(32) UNIQUE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  category_id   VARCHAR(64) REFERENCES categories(id),
  gender        gender_category NOT NULL DEFAULT 'women',
  activity      activity_type NOT NULL DEFAULT 'training',
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  specs         JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_featured ON products(featured) WHERE featured = TRUE;

CREATE TABLE product_variants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_key VARCHAR(64) NOT NULL,
  color_name  VARCHAR(64) NOT NULL,
  color_hex   VARCHAR(7) NOT NULL DEFAULT '#000000',
  price_cents INT NOT NULL CHECK (price_cents > 0),
  stock       JSONB NOT NULL DEFAULT '{}',
  UNIQUE (product_id, variant_key)
);

CREATE TABLE product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt_text    VARCHAR(255) NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0
);

-- ─── Cart & wishlist ──────────────────────────────────────────
CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  size        VARCHAR(8) NOT NULL,
  quantity    INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, variant_id, size)
);

CREATE TABLE wishlist_items (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

-- ─── Orders ───────────────────────────────────────────────────
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  status          order_status NOT NULL DEFAULT 'pending',
  subtotal_cents  INT NOT NULL,
  shipping_cents  INT NOT NULL DEFAULT 0,
  tax_cents       INT NOT NULL DEFAULT 0,
  total_cents     INT NOT NULL,
  shipping_name   VARCHAR(120) NOT NULL,
  shipping_line1  VARCHAR(255) NOT NULL,
  shipping_line2  VARCHAR(255),
  shipping_city   VARCHAR(120) NOT NULL,
  shipping_state  VARCHAR(64) NOT NULL,
  shipping_zip    VARCHAR(20) NOT NULL,
  shipping_country VARCHAR(2) NOT NULL DEFAULT 'US',
  payment_ref     VARCHAR(120),
  payment_method  VARCHAR(32),
  shipping_phone  VARCHAR(32),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  variant_id    UUID NOT NULL REFERENCES product_variants(id),
  product_name  VARCHAR(255) NOT NULL,
  variant_name  VARCHAR(64) NOT NULL,
  size          VARCHAR(8) NOT NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  unit_price_cents INT NOT NULL
);

-- ─── Updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Store settings (singleton) ───────────────────────────────
CREATE TABLE app_settings (
  id                    INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sale_discount_percent INT NOT NULL DEFAULT 20 CHECK (sale_discount_percent >= 1 AND sale_discount_percent <= 90)
);

INSERT INTO app_settings (id, sale_discount_percent) VALUES (1, 20)
ON CONFLICT (id) DO NOTHING;
