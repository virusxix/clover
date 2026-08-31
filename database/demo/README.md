# Demo data (delete for real store launch)

Everything in this folder is **demo-only**: fake login accounts and sample sales for Analytics / P&L.

Catalog products stay in `../seed.js` — that is real inventory, not demo.

## Commands

```bash
npm run db:seed:demo          # demo users + analytics sales
npm run db:seed:analytics     # analytics sales only
npm run db:purge:demo         # remove demo sales from the database
```

## Before production / real store

1. Purge demo rows from the DB:
   ```bash
   npm run db:purge:demo
   ```
2. Delete this entire folder: `database/demo/`
3. Remove these scripts from root `package.json`:
   - `db:seed:demo`
   - `db:seed:analytics`
   - `db:purge:demo`
4. Create a real admin user (do not keep `admin@clover.com` / `demo@clover.com`).
