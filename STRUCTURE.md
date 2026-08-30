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
│   ├── seed.js             # Catalog + demo users
│   ├── run-schema.js       # Apply schema
│   └── run-seed.js         # Seed data
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
| `/`                 | Hero, must-haves, value props |
| `/shop`             | Filterable catalog            |
| `/product/[slug]`   | PDP, add to cart              |
| `/cart`             | Cart                          |
| `/checkout`         | Mock payment checkout         |
| `/account`          | Profile & password            |
| `/account/orders`   | Order history                 |
| `/account/wishlist` | Wishlist                      |
| `/admin`            | Dashboard, products, orders   |

## Environment

Copy `apps/api/.env.example` → `apps/api/.env` and set `DATABASE_URL`, `JWT_SECRET`.

Copy `apps/web/.env.local.example` → `apps/web/.env.local` with `NEXT_PUBLIC_API_URL`.
