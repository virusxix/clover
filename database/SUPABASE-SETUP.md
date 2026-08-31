# Supabase setup (if `npm run db:schema` fails)

Your direct host (`db.*.supabase.co`) is **IPv6-only**. If your network cannot reach IPv6, Node will fail with `ENETUNREACH` or `ENOTFOUND`.

## Option A — Session pooler (recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **Database**
2. Under **Connection string**, choose **URI** and **Session pooler** (port **5432**)
3. Copy the full URI and replace `DATABASE_URL` in `apps/api/.env`

Example shape (region varies — e.g. `ap-northeast-2`):

```env
DATABASE_URL=postgresql://postgres.oxcuxupqudvmsrqoutqr:YOUR_PASSWORD@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
```

This project is configured for **aws-1-ap-northeast-2** session pooler.

4. Run:

```powershell
npm run db:schema
npm run db:seed
npm run db:seed:demo   # optional demo users + analytics (database/demo/)
```

## Option B — SQL Editor (always works)

1. Supabase → **SQL Editor** → New query
2. Paste the contents of `database/schema.sql` → **Run**
3. Then run `npm run db:seed` and optionally `npm run db:seed:demo` (or paste seed data manually)

## Verify

```powershell
curl http://localhost:4000/api/health
curl http://localhost:4000/api/products
```

Products should return JSON, not a database error.
