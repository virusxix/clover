# THE CLOVER — Project Structure

```
clover/
├── apps/
│   ├── api/                # Express + JWT REST API (:4000)
│   │   └── src/
│   │       ├── server.js
│   │       ├── db.js
│   │       ├── middleware/
│   │       ├── routes/
│   │       └── utils/
│   └── web/                # Next.js 14 storefront + admin (:3000)
│       ├── public/assets/  # Served product images
│       └── src/
│           ├── app/        # App Router pages
│           ├── components/
│           └── lib/
├── database/
│   ├── schema.sql          # PostgreSQL DDL
│   ├── seed.js             # Catalog (categories + products)
│   ├── demo/               # DELETE for real store — users + fake analytics sales
│   ├── run-schema.js       # Apply schema
│   └── run-seed.js         # Seed catalog
├── assets/                 # Source product images
├── scripts/                # Image optimize / watermark tools
├── package.json            # npm workspaces (api + web)
├── render.yaml             # Render Blueprint
└── README.md
```

## Stack

| Layer    | Technology                       |
|----------|----------------------------------|
| Frontend | Next.js 14, React, Tailwind CSS  |
| Backend  | Node.js, Express                 |
| Database | PostgreSQL                       |
| Auth     | JWT (access + refresh), bcrypt   |

## Pages

| Route               | Description                   |
|---------------------|-------------------------------|
| `/`                 | Must-haves, featured, values  |
| `/shop`             | Filterable catalog            |
| `/product/[slug]`   | PDP, add to cart              |
| `/cart`             | Cart                          |
| `/checkout`         | Mock payment checkout         |
| `/account`          | Profile & password            |
| `/account/orders`   | Order history                 |
| `/account/wishlist` | Wishlist                      |
| `/admin`            | Overview, analytics, inventory, store POS, ICONIC, products, orders |

## Inventory ops

After base schema + seed:

```bash
npm run db:ops
```

This creates locations (`website`, `store`, `iconic`), inventory levels, store sales, ICONIC transfers/reports, and cost basis. Website checkout deducts `website` stock; store POS deducts `store`; ICONIC monthly reports deduct consignment stock.

## Environment

Copy `apps/api/.env.example` → `apps/api/.env` and set `DATABASE_URL`, `JWT_SECRET`.

Copy `apps/web/.env.local.example` → `apps/web/.env.local` with `NEXT_PUBLIC_API_URL`.
