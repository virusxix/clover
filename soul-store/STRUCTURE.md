# SOUL Store — Project Structure

```
soul-store/
├── database/
│   ├── schema.sql          # PostgreSQL DDL
│   ├── seed.js             # Catalog + demo users
│   ├── run-schema.js       # Apply schema
│   └── run-seed.js         # Seed data
├── apps/
│   ├── api/                # Express + JWT REST API
│   │   └── src/
│   │       ├── server.js
│   │       ├── db.js
│   │       ├── middleware/
│   │       ├── routes/
│   │       └── utils/
│   └── web/                # Next.js 14 storefront + admin
│       └── src/
│           ├── app/        # App Router pages
│           ├── components/
│           └── lib/
├── package.json            # npm workspaces
└── README.md
```

## Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Next.js 14, React, Tailwind CSS     |
| Backend  | Node.js, Express                    |
| Database | PostgreSQL                          |
| Auth     | JWT (access + refresh), bcrypt      |

## Pages

| Route              | Description                    |
|--------------------|--------------------------------|
| `/`                | Hero, must-haves, value props  |
| `/shop`            | Filterable catalog             |
| `/product/[slug]`  | PDP, add to cart               |
| `/cart`            | Cart                           |
| `/checkout`        | Mock payment checkout          |
| `/account`         | Profile & password             |
| `/account/orders`  | Order history                  |
| `/account/wishlist`| Wishlist                       |
| `/admin`           | Dashboard, products, orders    |

## Environment

Copy `apps/api/.env.example` → `apps/api/.env` and set `DATABASE_URL`, `JWT_SECRET`.

Copy `apps/web/.env.local.example` → `apps/web/.env.local` with `NEXT_PUBLIC_API_URL`.

## Assets

Symlink legacy product images into the web app:

```powershell
cd apps\web\public
cmd /c mklink /D assets ..\..\..\..\assets
```
