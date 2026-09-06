# THE CLOVER — Project Structure

Short map. Full product + security docs: **[README.md](./README.md)**.

```
clover/
├── apps/
│   ├── api/                # Express + JWT REST API (:4000)
│   │   └── src/
│   │       ├── server.js           # Helmet, CORS, rate limits, routes
│   │       ├── middleware/auth.js  # JWT + live admin role check
│   │       ├── routes/             # auth, products, cart, orders, admin*
│   │       ├── orders/             # status transitions + restock
│   │       ├── inventory/          # inventory_levels + movements
│   │       ├── checkout-service.js
│   │       ├── iconic/
│   │       ├── store-sales/
│   │       └── uploads/            # raster-only (no SVG)
│   └── web/                # Next.js 14 storefront + admin (:3000)
│       └── src/
│           ├── middleware.ts       # cookie gate + security headers assist
│           ├── app/api/[...path]/  # cookie-safe API proxy (strips JWTs)
│           ├── app/                # pages
│           ├── components/
│           └── lib/                # api, auth, cart, catalog, payments
├── database/
│   ├── schema.sql          # core DDL + order_status incl. awaiting_payment
│   ├── ops-schema.sql      # inventory / POS / ICONIC (re-runnable)
│   ├── seed.js
│   ├── run-schema.js
│   ├── run-ops-schema.js
│   └── run-seed.js
├── assets/
├── scripts/
├── render.yaml
├── DEPLOY-VERCEL.md
├── DEPLOY-RENDER.md
└── README.md
```

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | Next.js 14, React, Tailwind |
| Backend  | Node.js, Express, Helmet, rate-limit |
| Database | PostgreSQL (Supabase) |
| Auth     | JWT access + refresh, bcrypt, httpOnly cookies |

## Key routes

| Route | Description |
|-------|-------------|
| `/` `/shop` `/product/[slug]` | Catalog / PDP |
| `/cart` `/checkout` | Bag + Myanmar checkout (no postal) |
| `/account/*` | Profile, orders, wishlist |
| `/admin` | Overview, analytics, inventory, POS, ICONIC, products, orders, users |

## Inventory

```bash
npm run db:ops
```

Locations: `website` · `store` · `iconic`. Web cart/checkout use **website** levels only.
