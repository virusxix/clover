# Deploy THE CLOVER API on Render

The **Express API** lives on Render. The **Next.js storefront** should be on **Vercel** — see [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md).

[`render.yaml`](./render.yaml) defines **clover-api** only.

## 1. Create / update the API service

1. Sign in at [render.com](https://render.com).
2. **New** → **Blueprint** (or use an existing **clover-api** web service).
3. Connect **GitHub** → repository `virusxix/clover`.
4. Confirm root is `apps/api`, start command `npm start`.

If you previously had **clover-web** on Render, you can delete that service — the frontend moves to Vercel.

## 2. Environment variables

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Supabase **Session pooler** URI (port `5432`) |
| `CLIENT_URL` | Vercel storefront origin, e.g. `https://your-app.vercel.app` |
| `CORS_VERCEL_PREVIEWS` | `true` to allow `*.vercel.app` preview URLs |
| `JWT_SECRET` | Long random string (auto-generated if using Blueprint) |

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

| Service | Host |
|---------|------|
| API | `https://clover-api-….onrender.com` |
| Storefront | Vercel (see DEPLOY-VERCEL.md) |

## 4. Free tier notes

- API **spins down** after inactivity; first hit may take ~30s.
- Catalog pages show an error when the API/DB is down.

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| `/api/health` → 503 | Set/fix `DATABASE_URL` (session pooler) |
| CORS / login from Vercel | Set `CLIENT_URL` to the Vercel origin |
| Empty shop on Vercel | Set `NEXT_PUBLIC_API_URL` on Vercel to this API URL |
