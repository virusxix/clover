-- THE CLOVER — Row Level Security (defense-in-depth)
-- =====================================================
-- Architecture: browser → clover-api only → Postgres (DATABASE_URL / postgres role).
-- Frontend must NEVER use Supabase anon or service_role keys.
--
-- Effect:
--   • RLS ON for every public table → PostgREST anon/authenticated get ZERO rows
--     unless a policy exists (we intentionally add none for sensitive data).
--   • API keeps working: connection uses postgres / service-equivalent which
--     BYPASSES RLS (do NOT FORCE ROW LEVEL SECURITY).
--
-- Apply: npm run db:rls
-- Safe to re-run.

-- ─── Ensure client roles cannot touch tables even if RLS were misconfigured ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated';
  END IF;
END $$;

-- Default privileges for future tables created by postgres
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
  END IF;
END $$;

-- ─── Drop any existing policies (clean slate → default deny) ───────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
  END LOOP;
END $$;

-- ─── Enable RLS on all public base tables (no FORCE — API must bypass) ─────
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'  -- ordinary tables only
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    -- Explicitly do NOT force RLS (would break API as table owner)
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ─── Sensitive tables: document lock (no policies = deny for anon/auth) ────
-- refresh_tokens, admin_audit_events, users.password_hash path, app_settings,
-- inventory_*, store_sales*, iconic_*, customers, cart_items, wishlist_items,
-- orders, order_items — all covered by the loop above with zero policies.

-- Optional: if you ever expose PostgREST for a public catalog read-only,
-- add a narrow policy ONLY on products / product_variants / product_images /
-- categories — NEVER on users, refresh_tokens, orders, audit, or tokens.
-- Example (DISABLED by default — shop uses the API):
--
-- CREATE POLICY catalog_products_public_read ON products
--   FOR SELECT TO anon, authenticated
--   USING (true);
--
-- We leave NO such policies so Supabase "UNRESTRICTED" becomes locked.

COMMENT ON TABLE refresh_tokens IS
  'RLS enabled, no policies — client/PostgREST cannot read. API only.';
COMMENT ON TABLE admin_audit_events IS
  'RLS enabled, no policies — client/PostgREST cannot read. Admin via API only.';
COMMENT ON TABLE users IS
  'RLS enabled, no policies — never query via anon key. API filters by JWT sub.';
