# THE CLOVER — Full-Stack Sportswear Commerce

Premium gym / athleisure storefront for **Myanmar (MMK)**, with:

- Customer website (shop, bag, checkout, account)
- Owner admin + separate Reception floor dashboard (POS workers cannot see profit / users)
- Three separate logins: customer `/login`, admin `/admin/login`, reception `/reception/login`
- Express API + PostgreSQL (Supabase)

**Live stack:** Vercel (web) · Render (API) · Supabase (Postgres)

---

## Table of contents

1. [Architecture](#1-architecture)
2. [What we built](#2-what-we-built)
3. [Order & inventory flows](#3-order--inventory-flows)
4. [Payments (Myanmar)](#4-payments-myanmar)
5. [Security — multi-layer defense](#5-security--multi-layer-defense)
6. [Local setup](#6-local-setup)
7. [Environment variables](#7-environment-variables)
8. [Database](#8-database)
9. [Deploy](#9-deploy)
10. [Operations cheat sheet](#10-operations-cheat-sheet)
11. [Known limitations](#11-known-limitations)

---

## 1. Architecture

```
┌─────────────────────┐     same-origin /api/*      ┌──────────────────────┐
│  Next.js 14 (web)   │ ────── cookie proxy ──────► │  Express API         │
│  Vercel             │                             │  Render              │
│  storefront + admin │ ◄──── Set-Cookie rewrite ── │  JWT + business logic│
└─────────────────────┘                             └──────────┬───────────┘
                                                               │
                                                               ▼
                                                    ┌──────────────────────┐
                                                    │  PostgreSQL          │
                                                    │  Supabase            │
                                                    └──────────────────────┘
```

| Layer | Path | Role |
|-------|------|------|
| Storefront + Admin UI | `apps/web` | Next.js App Router, Tailwind, client islands for cart/checkout/admin |
| API proxy | `apps/web/src/app/api/[...path]/route.ts` | Forwards to Render; rewrites cookies; **strips JWTs from auth JSON** |
| Edge gate | `apps/web/src/middleware.ts` | Cookie check on `/admin`, `/account`, `/cart`, `/checkout` |
| Backend | `apps/api` | Auth, catalog, cart, checkout, admin, POS, ICONIC, uploads |
| Data | `database/` | `schema.sql` (core) + `ops-schema.sql` (inventory / POS / ICONIC) |

**Money:** amounts are whole **MMK** (column names still say `*_cents` for legacy). Display uses `Ks`.

---

## 2. What we built

### 2.1 Customer website

| Area | Behavior |
|------|----------|
| Home / Shop / New In | Catalog SSR where possible; filters (category, size, price, sale) |
| Product page | Color, size, **quantity stepper**, add to bag, wishlist, mobile sticky CTA |
| Bag | Live **item count badge** in header; qty −/+, remove; spaced price vs qty UI |
| Checkout | Name, phone, address, city, state/region — **no postal code** (Myanmar) |
| Account | Profile, password, orders, wishlist |
| Mobile | 16px inputs (stops iOS zoom loop); touch targets ≥44px; safe-area padding |

### 2.2 Auth

- Register / login with **httpOnly** cookies (`accessToken` ~15m, `refreshToken` ~7d)
- Passwords: **bcrypt** cost 12
- Refresh rotation; refresh tokens stored as **SHA-256 hashes** in DB
- Role: `customer` | `admin` | `reception` (register never accepts client-controlled role)

### 2.3 Three portals (separate logins)

| Portal | Login URL | Who | Sees |
|--------|-----------|-----|------|
| **Customer** | `/login` | `customer` only | Shop, bag, account, orders |
| **Admin** | `/admin/login` | `admin` only | Owner console + Floor/POS |
| **Reception** | `/reception/login` | `reception` only | Floor dashboard only |

Each login rejects the other roles. Middleware keeps each role on its portal (admins may also open `/reception` for POS).

**Assign a worker:** Admin → Users → set role to **Reception (floor)**. They open `/reception/login`.

#### Owner admin tabs

| Tab | Purpose |
|-----|---------|
| Overview | Sales snapshot, sale % setting |
| Analytics | Channel P&L, exports |
| Inventory | Multi-location stock (`website` / `store` / `iconic`), transfers, adjustments |
| POS | In-store sales: cash / KBZPay / MMQR / card; thermal receipts (XP-80C) |
| ICONIC | Consignment transfers + **monthly sold reports** (idempotent per month) |
| Products | CRUD, codes (e.g. `SO1pljk`), images, sale tags |
| Orders | Website orders, pending badge **1 / 2 / 3…**, confirm payment, pack, ship, print |
| Users | List / set `customer` · `reception` · `admin` |

#### Reception floor tabs

| Tab | Purpose |
|-----|---------|
| Floor | Today’s store sales (count + MMK, no profit), pending web orders, low store stock |
| POS | Same terminal as admin — charge, line/order discounts, print |
| Orders | Pack / confirm payment / ship / print |
| Inventory | Qty adjust & transfer — **cost column hidden** |
| ICONIC | Transfers + monthly sold entry |

**Reception alerts:** poll for new web orders, optional browser notify. **Auto-print defaults OFF** (enable explicitly on shared PCs).

### 2.4 Receipts (thermal)

- Official mark: embedded `logo-icon.png` (not decorative SVG)
- Store vs website layouts are **different** (store sale vs online packing slip)
- Print CSS forces **solid black** (thermal printers wash out gray)

---

## 3. Order & inventory flows

### 3.1 Stock locations (single source of truth)

| Location | Used by |
|----------|---------|
| `website` | Online catalog, cart checks, web checkout |
| `store` | POS sales |
| `iconic` | Partner consignment; monthly report deducts here |

All authoritative qty lives in **`inventory_levels`**. Legacy `product_variants.stock` JSONB is synced only as a mirror after website adjustments.

### 3.2 Website checkout → stock

```
Customer pays with…
├─ COD (Mandalay area only)
│    → order status: pending
│    → website stock deducted immediately
│    → Admin: “Start packaging” → processing → shipped
│
└─ KBZPay / Card (offline confirmation)
     → order status: awaiting_payment
     → stock NOT deducted yet
     → Admin: “Confirm payment & pack” → deducts stock + processing → shipped
```

**Cancel:**

- From `awaiting_payment` → cancel (nothing to restock)
- From `pending` / `processing` / `shipped` / `delivered` → **restock** website qty + ledger note

### 3.3 ICONIC monthly report

- One report per calendar month (`UNIQUE report_month`)
- Re-posting the same month → **HTTP 409** (prevents double stock deduct)
- First successful post inserts lines and deducts ICONIC inventory

### 3.4 Cart rules

- Add / update qty validated against **website** `inventory_levels`
- Max 10 per line; merge on same variant+size
- Header bag count = sum of quantities; refreshed after add / update / remove / **successful checkout**

---

## 4. Payments (Myanmar)

| Channel | Methods | Notes |
|---------|---------|--------|
| Website | KBZPay, Card, COD | COD only if city/state looks like Mandalay area |
| Store POS | Cash, KBZPay, MMQR, Card | Recorded on sale; no card PAN collected |

There is **no payment gateway / webhook** yet. KBZPay and card are “pay with our team, then admin confirms.” Orders are real in the DB; inventory commit rules above protect unpaid stock for non-COD.

---

## 5. Security — multi-layer defense

Defense is layered so one failure does not open the whole shop.

### Layer A — Browser / Next.js edge

| Control | Where |
|---------|--------|
| Session cookie required for `/admin`, `/account`, `/cart`, `/checkout` | `apps/web/src/middleware.ts` |
| Redirect to `/login?next=…` if logged out | same |
| Security headers: CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, HSTS (prod) | `apps/web/next.config.mjs` |
| `poweredByHeader: false` | same |
| Login `next` path sanitized (no open `//` redirects) | `LoginClient.tsx` |
| Form fields ≥16px (anti-zoom / less accidental data entry issues) | `globals.css` |

### Layer B — Same-origin API proxy

| Control | Where |
|---------|--------|
| Browser talks to `/api/*` on the Vercel host (cookies stay first-party) | `app/api/[...path]/route.ts` |
| Upstream `Set-Cookie` Domain stripped; Secure adjusted for local | same |
| Auth responses **never** return raw `accessToken` / `refreshToken` to the browser | same (parse fail → generic error, not raw body) |
| Cold-start retries for Render free tier | same |

### Layer C — Express API

| Control | Where |
|---------|--------|
| Helmet | `server.js` |
| CORS allowlist (`CLIENT_URL` / `CLIENT_URLS`); optional preview flag **warned** | same |
| Global + route rate limits (auth, checkout, admin, upload, general API) | same |
| JSON body limit 2mb | same |
| Parameterized SQL (`$1…`) everywhere | routes / services |
| Zod validation on writes | cart, orders, admin |
| `requireAuth` (JWT access only; refresh type rejected) | `middleware/auth.js` |
| `requireAdmin` = JWT claim **and** live `users.role` in DB | same (demotion is immediate) |
| `requireStoreStaff` = live role `admin` \| `reception` (floor ops; no analytics) | same |
| `cloverRole` HttpOnly cookie for Next page gates (`/admin`, `/reception`) | `auth-cookies.js` + `middleware.ts` |
| `admin_audit_events` for role / payment / order / stock / POS / export | `audit.js` |
| Promote-to-admin requires actor password; role change revokes target sessions | `admin.js` |
| Logout + password change revoke **all** refresh tokens for that user | `auth.js` / `jwt.js` |
| `CORS_VERCEL_PREVIEWS` ignored when `NODE_ENV=production` | `server.js` |
| Generic 500 messages (no stack traces to clients) | `server.js` |
| Upload: raster images only; **SVG blocked** (XSS) | `uploads/upload-storage.js` |
| Upload static: `X-Content-Type-Options: nosniff` | `server.js` |
| Seed refuses default `Admin123!` when `NODE_ENV=production` | `database/seed.js` |

### Layer D — Data & secrets

| Control | Practice |
|---------|----------|
| `.env` gitignored | never commit secrets |
| Strong `JWT_SECRET` in production | required |
| Refresh tokens hashed at rest | `utils/jwt.js` |
| Cookies: httpOnly, SameSite=lax, Secure in prod | `auth-cookies.js` |
| Admin password via `ADMIN_PASSWORD` | not in README |

### Layer E — Application logic

| Control | Behavior |
|---------|----------|
| Owner-scoped order reads | `user_id` match |
| Checkout transactions | BEGIN → lock cart → stock → COMMIT / ROLLBACK |
| ICONIC month idempotency | 409 on duplicate |
| Cancel restock | ledger + inventory_levels |
| Receipt HTML | `escapeHtml` before print |
| Offline payments | no card PAN/CVC fields on the site |

### Ops checklist (production)

1. Set long random `JWT_SECRET`
2. Set `CLIENT_URL` / `CLIENT_URLS` to your real Vercel domain(s) only  
3. **Do not** set `CORS_VERCEL_PREVIEWS=true` in production  
4. Set strong `ADMIN_PASSWORD` before `db:seed`  
5. Keep Render + Vercel on HTTPS  
6. Rotate admin password if seed ever used defaults in a shared environment  

---

## 6. Local setup

### Prerequisites

- Node.js **20+**
- PostgreSQL **14+** (or Supabase project)

### Install

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/api/.env`: `DATABASE_URL`, `JWT_SECRET`.  
Edit `apps/web/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000`.

### Database

```bash
npm run db:schema   # core tables + enums
npm run db:ops      # inventory / POS / ICONIC / awaiting_payment enum
npm run db:seed     # catalog + default admin (dev)
```

### Assets

```bash
# Prefer symlink
ln -sfn ../../../assets apps/web/public/assets
```

### Run

```bash
npm run dev
```

| App | URL |
|-----|-----|
| Storefront / Admin | http://localhost:3000 |
| API | http://localhost:4000 |
| Health | http://localhost:4000/api/health |

---

## 7. Environment variables

### API (`apps/api/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres (prefer Supabase **session pooler**) |
| `JWT_SECRET` | yes (prod) | Sign access/refresh tokens |
| `CLIENT_URL` | yes | Primary storefront origin for CORS |
| `CLIENT_URLS` | no | Extra origins, comma-separated |
| `CORS_VERCEL_PREVIEWS` | no | **Avoid in prod** — allows all `*.vercel.app` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | recommended | Seeded admin |
| `PORT` | no | Default `4000` |

### Web (`apps/web/.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | yes on Vercel | Render API base URL (https) |
| `NEXT_PUBLIC_ASSETS_BASE` | no | Optional CDN prefix |

---

## 8. Database

| Script | File | Safe to re-run? |
|--------|------|-----------------|
| `npm run db:schema` | `database/schema.sql` | Fresh installs (bare `CREATE`) |
| `npm run db:ops` | `database/ops-schema.sql` | Yes (`IF NOT EXISTS`, additive enum) |
| `npm run db:seed` | `database/seed.js` | Upserts catalog; ensures one admin |

Important enums / statuses:  
`awaiting_payment` · `pending` · `processing` · `shipped` · `delivered` · `cancelled`

---

## 9. Deploy

| Piece | Guide |
|-------|--------|
| Web (Vercel) | [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md) |
| API (Render) | [DEPLOY-RENDER.md](./DEPLOY-RENDER.md) |
| Blueprint | `render.yaml` |

After deploy: open admin → Orders; place a test COD (Mandalay) and a test KBZPay order; confirm payment & pack; print receipt on XP-80C (scale 100%, margins none).

---

## 10. Operations cheat sheet

| Task | How |
|------|-----|
| New web order badge | Red count on **Orders** tab (pending + awaiting payment) |
| Confirm KBZPay/card | Orders → **Confirm payment & pack** |
| COD pack | Orders → **Start packaging** |
| Cancel & restock | Set status **cancelled** (if stock was held) |
| Store sale | Reception or Admin → **POS** → charge → print |
| ICONIC month sold | Reception or Admin → **ICONIC** → one report per month only |
| Promote floor staff | Admin → Users → role **Reception** |
| Sale % | Admin Overview → sale discount setting |
| Thermal paper | POS paper selector (80mm XP-80C default) |

---

## 11. Known limitations

- No PSP integration yet (KBZPay/card are offline + admin confirm)
- COD Mandalay check is a soft string match on city/state
- Checkout has no idempotency key (avoid double-click spam; rate-limited)
- Catalog shop query defaults to `gender=women`
- Product detail is largely client-rendered (SEO can improve with RSC)
- `CORS_VERCEL_PREVIEWS` is convenient for previews but unsafe if left on in production

---

## Repo map

```
clover/
├── apps/
│   ├── api/                 # Express API
│   └── web/                 # Next.js storefront + admin
├── database/                # schema, ops-schema, seed
├── assets/                  # product imagery source
├── scripts/                 # image tooling
├── STRUCTURE.md             # short file tree
├── DEPLOY-VERCEL.md
├── DEPLOY-RENDER.md
└── README.md                # this file
```

---

## License / brand

Private project for **THE CLOVER** sportswear. Do not commit secrets, customer exports, or production `.env` files.
