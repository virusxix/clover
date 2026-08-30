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

### One-time schema + seed

From your machine (with `DATABASE_URL` set), or Render **Shell** on `clover-api`:

```bash
npm install
npm run db:schema
npm run db:seed
```

Demo logins after seed: `demo@clover.com` / `Demo1234!`, `admin@clover.com` / `Admin123!`

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

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| API build fails | Confirm `DATABASE_URL` is set on **clover-api** |
| Login works locally, not on Render | Redeploy **clover-web** after **clover-api** is live |
| Empty shop | Run `db:schema` and `db:seed` against the same `DATABASE_URL` |
| 502 on cold start | Wait and refresh; free tier is waking up |
| Webpack / `tailwindcss` not found | Build must install dev deps (`NPM_CONFIG_PRODUCTION=false npm install`) — see `render.yaml` |
