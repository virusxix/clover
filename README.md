# THE CLOVER — Full-Stack E-Commerce

Sportswear storefront with **Next.js 14**, **Express**, **PostgreSQL**, and **JWT auth**.

## Layout

```
clover/
├── apps/
│   ├── api/          # Backend (Express, port 4000)
│   └── web/          # Frontend (Next.js, port 3000)
├── database/         # Schema + seed
├── assets/           # Product images (source)
├── scripts/          # Image tooling
├── package.json      # npm workspaces — run both apps
├── render.yaml       # API on Render
└── DEPLOY-VERCEL.md  # Storefront on Vercel
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+

### 1. Create database

```sql
CREATE DATABASE soul_store;
```

### 2. Install & configure

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/api/.env` with your `DATABASE_URL` and `JWT_SECRET`.

**Supabase:** Use the connection string from Project Settings → Database. SSL is enabled automatically for `*.supabase.co` hosts.

### 3. Product images

Images live in `assets/` and are also under `apps/web/public/assets/`. To re-sync:

```bash
# Linux / macOS
ln -sfn ../../../assets apps/web/public/assets

# Or copy:
# cp -a assets/. apps/web/public/assets/
```

### 4. Migrate & seed

```bash
npm run db:schema
npm run db:ops
npm run db:seed
```

### 5. Run frontend + backend

```bash
npm run dev
```

| App        | URL                     |
|------------|-------------------------|
| Storefront | http://localhost:3000   |
| API        | http://localhost:4000   |

Separate: `npm run dev:api` or `npm run dev:web`.

## Features

- **Storefront:** Hero, #Must Have grid, filterable shop, PDP, cart, mock checkout
- **Account:** Profile, password, order history, wishlist
- **Admin:** Sales metrics, products, order status, users
- **Security:** JWT access + refresh tokens, bcrypt, rate-limited auth, Helmet

See [STRUCTURE.md](./STRUCTURE.md) for the file tree.

**Deploy:** storefront → [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md) · API → [DEPLOY-RENDER.md](./DEPLOY-RENDER.md).
