# Deploy THE CLOVER on Render

Two web services (API + Next.js storefront) are defined in [`render.yaml`](./render.yaml).

## 1. Create the Blueprint

1. Sign in at [render.com](https://render.com).
2. **New** → **Blueprint**.
3. Connect **GitHub** → repository `virusxix/clover`.
4. Render reads `render.yaml` and creates **clover-api** and **clover-web**.

## 2. Database (required)

The app uses **PostgreSQL** (e.g. Supabase). On the **clover-api** service:

1. **Environment** → add **`DATABASE_URL`** with your Supabase **Session pooler** URI  
   (Dashboard → Project Settings → Database → Connection string, port `5432`).
2. Save and redeploy if the service already failed without it.

`/api/health` returns **503** when the database is unreachable. Fix `DATABASE_URL` before expecting the shop to work.

### One-time schema + seed

```bash
npm install
npm run db:schema
npm run db:ops      # inventory locations, store POS, ICONIC, cost basis
npm run db:seed         # catalog only
npm run db:seed:demo    # optional: demo users + analytics/P&L sample sales
```

**Demo data lives in `database/demo/`.** Before a real store launch: `npm run db:purge:demo`, delete that folder, and remove the `db:seed:demo` / `db:seed:analytics` / `db:purge:demo` scripts from `package.json`. Create a real admin — do not keep `admin@clover.com` / `demo@clover.com`.

For production demo users only (without deleting the folder yet):

```bash
SEED_DEMO_USERS=true npm run db:seed:demo
```

## 3. URLs

| Service     | Default URL                          |
|------------|---------------------------------------|
| Storefront | `https://clover-web.onrender.com`     |
| API        | `https://clover-api.onrender.com`     |

`CLIENT_URL` and `NEXT_PUBLIC_API_URL` are wired automatically via `RENDER_EXTERNAL_URL`.

The storefront proxies `/api/*` to the API so auth cookies stay on the web origin.

## 4. Free tier notes

- Services **spin down** after inactivity; first load may take ~30s.
- Upgrade plan or use a cron ping if you need always-on.
- Catalog pages show an explicit error when the API/DB is down (not an empty filter message).

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| `/api/health` → 503 | Set/fix `DATABASE_URL` on **clover-api** (session pooler) |
| API build fails | Confirm `DATABASE_URL` is set on **clover-api** |
| Login works locally, not on Render | Redeploy **clover-web** after **clover-api** is live |
| Empty / error shop | Run `db:schema` and `db:seed` against the same `DATABASE_URL` |
| 502 on cold start | Wait and refresh; free tier is waking up |
| Webpack / `tailwindcss` not found | Build must install dev deps (`NPM_CONFIG_PRODUCTION=false npm install`) — see `render.yaml` |
