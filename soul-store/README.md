# THE CLOVER — Full-Stack E-Commerce

Modern sportswear storefront rebuilt with **Next.js 14**, **Express**, **PostgreSQL**, and **JWT authentication**. Clean glass UI with rounded cards, grey drop shadows, and THE CLOVER branding (`assets/logo-icon.png`).

## Quick Start

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 14+

### 2. Create database

```sql
CREATE DATABASE soul_store;
```

### 3. Install & configure

```powershell
cd c:\clover\soul-store
npm install
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.local.example apps\web\.env.local
```

Edit `apps/api/.env` with your `DATABASE_URL` and `JWT_SECRET`.

**Supabase:** Use the connection string from Project Settings → Database. SSL is enabled automatically for `*.supabase.co` hosts.

### 4. Symlink product images

```powershell
cd apps\web\public
cmd /c mklink /D assets ..\..\..\..\assets
```

### 5. Migrate & seed

```powershell
npm run db:schema
npm run db:seed
```

### 6. Run dev servers

```powershell
npm run dev
```

- **Storefront:** http://localhost:3000
- **API:** http://localhost:4000

## Demo Accounts

| Role     | Email           | Password   |
|----------|-----------------|------------|
| Customer | demo@clover.com   | Demo1234!  |
| Admin    | admin@clover.com  | Admin123!  |

## Features

- **Storefront:** Hero, #Must Have grid, filterable shop, PDP, cart, mock checkout
- **Account:** Profile, password, order history, wishlist
- **Admin:** Sales metrics, products, order status, users
- **Security:** JWT access + refresh tokens, bcrypt, rate-limited auth, Helmet

## Project Layout

See [STRUCTURE.md](./STRUCTURE.md) for the full file tree and database schema overview.

## Production Notes

- Replace mock checkout with **Stripe** or **PayPal** SDK — never store raw card data
- Optimize images as **WebP** for sub-2s page loads
- Set strong `JWT_SECRET` and enable HTTPS + secure cookies
