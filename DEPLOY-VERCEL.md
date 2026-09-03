# Deploy storefront on Vercel (API on Render)

THE CLOVER is a split deploy:

| Piece | Host | Path |
|-------|------|------|
| Storefront (Next.js) | **Vercel** | `apps/web` |
| API (Express) | **Render** | `apps/api` |

The Next.js app proxies `/api/*` and `/uploads/*` to your Render API, so login cookies stay on your Vercel domain.

## 1. Keep the API on Render

1. Deploy **clover-api** (Blueprint or existing service) — see [DEPLOY-RENDER.md](./DEPLOY-RENDER.md).
2. Note the API URL, e.g. `https://clover-api-xxxx.onrender.com`.
3. On **clover-api → Environment**, set:
   - `CLIENT_URL` = your Vercel URL (e.g. `https://your-app.vercel.app`) — no trailing slash
   - `CORS_VERCEL_PREVIEWS` = `true` (optional; allows preview deployments)
   - `DATABASE_URL` = Supabase session pooler URI

You do **not** need a Render web service for the frontend.

If Render still shows **clover-web**, delete it: Dashboard → clover-web → Settings → Delete Web Service.
(See [DEPLOY-RENDER.md](./DEPLOY-RENDER.md).)

## 2. Deploy the frontend on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → import `virusxix/clover`.
2. Configure the project:
   - **Root Directory:** `apps/web`  ← required
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build` (default)
   - **Install Command:** `npm install` (default)
3. **Environment Variables** (Production + Preview):

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_API_URL` | `https://clover-api-xxxx.onrender.com` (your Render API, no trailing slash) |

4. Deploy.

After the first Vercel URL is known, put that exact origin into Render `CLIENT_URL` and redeploy the API if needed.

## 3. Custom domain (optional)

- Add the domain in Vercel → Project → Settings → Domains.
- Update Render `CLIENT_URL` to `https://yourdomain.com`.
- Redeploy API.

## 4. Local vs production

| Env | `NEXT_PUBLIC_API_URL` / rewrite target |
|-----|----------------------------------------|
| Local | `http://localhost:4000` (`.env.local`) |
| Vercel | Render API HTTPS URL |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Vercel build can’t find Next.js | Root Directory must be `apps/web` |
| Shop empty / API errors | Set `NEXT_PUBLIC_API_URL` on Vercel to the live Render API |
| Login fails / CORS error | Set Render `CLIENT_URL` to the Vercel origin; enable `CORS_VERCEL_PREVIEWS` for previews |
| Cold API (~30s) | Free Render spins down; first request wakes it |
| Uploads 404 | Confirm `/uploads` rewrite and that files exist on the API host disk |
