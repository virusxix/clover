# Deploy THE CLOVER API on Render (backend only)

| Piece | Host |
|-------|------|
| **API** (`apps/api`) | **Render** ← this file |
| **Storefront** (`apps/web`) | **Vercel** — see [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md) |

[`render.yaml`](./render.yaml) defines **only `clover-api`**. There is **no** frontend service on Render.

## Delete the old Render frontend (required)

If you still see **clover-web** (or any Next.js service) on Render from an older Blueprint:

1. Open [Render Dashboard](https://dashboard.render.com/)
2. Click **clover-web** (or the service whose root is `apps/web`)
3. **Settings** → scroll to **Delete Web Service** → confirm

Also remove any GitHub environment named like `main - clover-web` if you want a clean Deployments list (optional).

Until you delete it, Render will keep rebuilding the frontend on every push even though it is not in `render.yaml`.

## 1. API service

1. Sign in at [render.com](https://render.com)
2. Use existing **clover-api**, or **New → Blueprint** with this repo (creates API only)
3. Confirm:
   - Root: `apps/api`
   - Build: `npm install`
   - Start: `npm start`

## 2. Environment variables (clover-api)

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Supabase **Session pooler** URI (port `5432`) |
| `CLIENT_URL` | Your Vercel URL, e.g. `https://clover-website-omega.vercel.app` (no trailing slash) |
| `CORS_VERCEL_PREVIEWS` | `true` |
| `JWT_SECRET` | Long random string (Blueprint can auto-generate) |

`/api/health` returns **503** when the database is unreachable.

### One-time schema + seed (from your machine)

```bash
npm install
npm run db:schema
npm run db:ops
npm run db:seed
npm run db:seed:demo    # optional
```

## 3. URLs

| Service | Where |
|---------|--------|
| API | `https://clover-api-….onrender.com` |
| Storefront | Vercel only |

Set Vercel env `NEXT_PUBLIC_API_URL` to the API URL (see DEPLOY-VERCEL.md).

## 4. Free tier

- API **spins down** after inactivity; first hit may take ~30s
- Do **not** run the Next.js app on Render — use Vercel

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| Render still building frontend | Delete **clover-web** in the dashboard (above) |
| `/api/health` → 503 | Fix `DATABASE_URL` |
| Login/CORS from Vercel | Set `CLIENT_URL` to the exact Vercel origin |
| Empty shop on Vercel | Set `NEXT_PUBLIC_API_URL` on Vercel to this API |
