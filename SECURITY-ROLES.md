# Role security — Customer / Reception / Admin

## Architecture (required)

```
Browser (clover-web)  →  clover-api (JWT cookies)  →  Supabase Postgres
                              ↑
                     DATABASE_URL only (postgres / privileged)
```

- **Never** put Supabase `anon` or `service_role` keys in the frontend.
- Shop and dashboards talk to **your API only**.
- RLS is **defense-in-depth** against accidental PostgREST / leaked anon key access.

## Apply RLS

```bash
npm run db:rls
```

SQL source: [`database/rls-schema.sql`](./database/rls-schema.sql)

What it does:

1. `REVOKE ALL` on public tables/sequences/functions from `anon` + `authenticated`
2. Drops existing RLS policies (clean slate)
3. `ENABLE ROW LEVEL SECURITY` on every public table
4. Does **not** `FORCE ROW LEVEL SECURITY` (API as table owner must keep working)
5. Adds **no** permissive policies → default deny for client roles

After apply, Supabase table UI should show RLS **enabled** (not UNRESTRICTED).

## Roles (API)

| Role | Middleware | Access |
|------|------------|--------|
| `customer` | `requireAuth` + `user_id = req.user.id` | Own profile, cart, wishlist, orders |
| `reception` | `requireStoreStaff` (live DB role) | Floor orders, POS, inventory, ICONIC, customers; costs hidden |
| `admin` | `requireAdmin` (live DB role) | Catalog, users, settings, analytics, exports, uploads, audit log |

JWT `role` claim is **not** trusted alone for admin/staff — middleware re-reads `users.role`.

### Route map

| Path prefix | Guard |
|-------------|--------|
| `/api/auth/*` (me/profile/password) | `requireAuth` |
| `/api/cart`, `/api/orders`, `/api/wishlist` | `requireAuth` + own-row filters |
| `/api/admin/orders*`, `/api/admin/floor/*`, `/api/admin/ops/*` (most) | `requireStoreStaff` |
| `/api/admin/ops/analytics/*`, `/export/*` | `requireAdmin` |
| `/api/admin/*` (products, users, settings, dashboard, audit-events) | `requireAdmin` |
| `/api/admin/upload` | `requireAdmin` |

## Audit logging

Table: `admin_audit_events` (RLS on, no client policies).

Logged actions include: role changes, order status/payment, inventory adjust/transfer, store sales, ICONIC transfer/report, customer create/update, settings update, CSV export, image upload, password change.

Admin list: `GET /api/admin/audit-events?limit=50`

## Already OK vs was risky

### Already OK
- No Supabase client in the frontend
- Customer cart/orders/wishlist scoped by `user_id`
- Admin vs reception split via `requireAdmin` / `requireStoreStaff`
- Live DB role check for privileged routes
- Reception portal isolation in Next middleware
- Costs hidden from reception in ops inventory/variants
- Many sensitive actions already audited

### Was risky (fixed / addressed)
- **All tables UNRESTRICTED (RLS off)** → anyone with Supabase anon key + PostgREST could read/write everything
- Gaps in audit coverage (settings, ICONIC, customers, uploads) → filled
- No admin-facing audit list endpoint → added `GET /api/admin/audit-events`

### Still operational risk (not RLS)
- `DATABASE_URL` is privileged — protect Render env vars
- Render free cold starts can make login/API slow
- JWT access TTL 15m — refresh path must keep working

## Test checklist

Use three accounts: customer, reception, admin. Prefer curl with cookie jar after login.

### A. Customer cannot hit staff/admin APIs
1. Login as customer on main `/login`
2. `GET /api/admin/orders` → **403** Store staff
3. `GET /api/admin/dashboard` → **403** Admin
4. `GET /api/admin/users` → **403**
5. `GET /api/admin/settings` → **403**
6. `GET /api/admin/ops/analytics/summary` → **403**
7. `GET /api/admin/audit-events` → **403**
8. `GET /api/orders` → **200** (own only)
9. `GET /api/orders/{otherUsersOrderId}` → **404**

### B. Reception cannot hit owner APIs
1. Login via `/reception/login`
2. `GET /api/admin/orders` → **200**
3. `GET /api/admin/ops/inventory` → **200** (no `costCents` / costs)
4. `GET /api/admin/dashboard` → **403**
5. `GET /api/admin/users` → **403**
6. `PATCH /api/admin/settings` → **403**
7. `GET /api/admin/ops/analytics/summary` → **403**
8. `POST /api/admin/upload` → **403**
9. Opening `/admin` in browser → redirected to `/reception`
10. Opening `/shop` as reception → blocked by middleware

### C. Admin full access
1. `GET /api/admin/dashboard` → **200**
2. `GET /api/admin/audit-events` → **200**
3. `PATCH /api/admin/users/:id/role` with confirm password when promoting to admin
4. Confirm `admin_audit_events` row written

### D. Supabase / RLS
1. After `npm run db:rls`, Table Editor shows RLS enabled
2. With **anon** key only (Supabase API settings), `GET https://<ref>.supabase.co/rest/v1/users` → empty / permission denied
3. Same for `refresh_tokens`, `orders`, `admin_audit_events`
4. API health + shop still work (API uses privileged `DATABASE_URL`)

### E. Tokens locked
1. Anon cannot `select` from `refresh_tokens`
2. Anon cannot `select` from `admin_audit_events`
