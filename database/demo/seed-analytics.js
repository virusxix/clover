/**
 * Demo analytics seed
 * -------------------
 * One job: insert sample website orders, store POS sales, and ICONIC
 * transfers/reports across days/weeks/months/years so Analytics + P&L
 * have realistic numbers to show.
 *
 * Lives in database/demo/ — delete this folder for real store launch.
 * Requires: db:schema, db:ops, db:seed (catalog). Prefer: npm run db:seed:demo
 * Safe to re-run: clears previous rows tagged with [demo-analytics].
 */

import { LOCATIONS } from "../../apps/api/src/inventory/locations.js";
import { DEMO_TAG, purgeDemoData } from "./purge-demo.js";

const TAG = DEMO_TAG;

/** Days ago helper → Date */
function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function monthStart(year, monthIndex0) {
  return new Date(Date.UTC(year, monthIndex0, 1));
}

/**
 * @param {(text: string, params?: unknown[]) => Promise<{ rows: any[] }>} query
 */
export async function runAnalyticsSeed(query) {
  await purgeDemoData(query);

  const customerId = await ensureDemoCustomer(query);
  const variants = await loadVariants(query);
  if (variants.length < 2) {
    throw new Error("Need catalog products first — run npm run db:seed");
  }

  // Ensure cost + stock at website & store so transfers/sales succeed
  await ensureCostsAndStock(query, variants);

  // ── Website orders (channel: website) ───────────────────────
  const webOrders = [
    { days: 0, items: [{ v: 0, size: "M", qty: 1 }] },
    { days: 1, items: [{ v: 1, size: "S", qty: 2 }] },
    { days: 3, items: [{ v: 0, size: "L", qty: 1 }, { v: 2, size: "M", qty: 1 }] },
    { days: 8, items: [{ v: 3, size: "M", qty: 1 }] },
    { days: 15, items: [{ v: 1, size: "M", qty: 1 }, { v: 4 % variants.length, size: "S", qty: 1 }] },
    { days: 40, items: [{ v: 0, size: "M", qty: 2 }] },
    { days: 70, items: [{ v: 2, size: "L", qty: 1 }] },
    { days: 120, items: [{ v: 1, size: "M", qty: 1 }] },
    { days: 200, items: [{ v: 0, size: "S", qty: 1 }, { v: 3, size: "M", qty: 1 }] },
    { days: 400, items: [{ v: 2, size: "M", qty: 1 }] }, // last year-ish
  ];

  for (const o of webOrders) {
    await insertWebsiteOrder(query, {
      userId: customerId,
      soldAt: daysAgo(o.days),
      lines: o.items.map((it) => ({
        variant: variants[it.v % variants.length],
        size: it.size,
        qty: it.qty,
      })),
    });
  }

  // ── Store POS sales ─────────────────────────────────────────
  const storeSales = [
    { days: 0, v: 0, size: "M", qty: 1 },
    { days: 2, v: 1, size: "L", qty: 1 },
    { days: 6, v: 2, size: "S", qty: 2 },
    { days: 20, v: 0, size: "M", qty: 1 },
    { days: 55, v: 3, size: "M", qty: 1 },
    { days: 90, v: 1, size: "M", qty: 2 },
    { days: 365, v: 0, size: "L", qty: 1 },
  ];

  for (const s of storeSales) {
    await insertStoreSale(query, {
      soldAt: daysAgo(s.days),
      variant: variants[s.v % variants.length],
      size: s.size,
      qty: s.qty,
    });
  }

  // ── ICONIC: send stock, then monthly sold reports ───────────
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  await insertIconicTransfer(query, {
    transferredAt: daysAgo(80),
    lines: [
      { variant: variants[0], size: "M", qty: 8 },
      { variant: variants[1], size: "S", qty: 6 },
      { variant: variants[2 % variants.length], size: "L", qty: 5 },
    ],
  });

  await insertIconicTransfer(query, {
    transferredAt: daysAgo(40),
    lines: [
      { variant: variants[0], size: "M", qty: 4 },
      { variant: variants[3 % variants.length], size: "M", qty: 5 },
    ],
  });

  // Three monthly reports (current, previous, two months ago)
  const reports = [
    {
      month: monthStart(y, m),
      lines: [
        { variant: variants[0], size: "M", qty: 3, revFactor: 0.85 },
        { variant: variants[1], size: "S", qty: 2, revFactor: 0.85 },
      ],
    },
    {
      month: monthStart(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1),
      lines: [
        { variant: variants[0], size: "M", qty: 4, revFactor: 0.8 },
        { variant: variants[2 % variants.length], size: "L", qty: 2, revFactor: 0.8 },
      ],
    },
    {
      month: monthStart(m < 2 ? y - 1 : y, m < 2 ? m + 10 : m - 2),
      lines: [
        { variant: variants[1], size: "S", qty: 3, revFactor: 0.8 },
        { variant: variants[3 % variants.length], size: "M", qty: 2, revFactor: 0.75 },
      ],
    },
  ];

  for (const r of reports) {
    await insertIconicReport(query, r);
  }

  console.log("[seed-analytics] Demo sales written for website, store, and ICONIC.");
}

async function ensureDemoCustomer(query) {
  const { rows } = await query(
    `SELECT id FROM users WHERE email = 'demo@clover.com' LIMIT 1`
  );
  if (rows[0]) return rows[0].id;

  const { rows: created } = await query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ('demo@clover.com', '$2a$12$placeholderhashnotusedxxxxxx', 'Demo Customer', 'customer')
     RETURNING id`
  );
  return created[0].id;
}

async function loadVariants(query) {
  const { rows } = await query(
    `SELECT v.id, v.price_cents, COALESCE(v.cost_cents, 0) AS cost_cents,
            v.color_name, p.id AS product_id, p.name AS product_name
     FROM product_variants v
     JOIN products p ON p.id = v.product_id
     ORDER BY p.name, v.color_name
     LIMIT 12`
  );
  return rows;
}

async function ensureCostsAndStock(query, variants) {
  for (const v of variants) {
    const cost = v.cost_cents > 0 ? v.cost_cents : Math.round(v.price_cents * 0.45);
    await query(`UPDATE product_variants SET cost_cents = $2 WHERE id = $1`, [v.id, cost]);
    v.cost_cents = cost;

    for (const loc of [LOCATIONS.WEBSITE, LOCATIONS.STORE, LOCATIONS.ICONIC]) {
      for (const size of ["XS", "S", "M", "L", "XL"]) {
        const base = loc === LOCATIONS.ICONIC ? 2 : 20;
        await query(
          `INSERT INTO inventory_levels (variant_id, location_id, size, qty, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (variant_id, location_id, size)
           DO UPDATE SET qty = GREATEST(inventory_levels.qty, EXCLUDED.qty)`,
          [v.id, loc, size, base]
        );
      }
    }
  }
}

async function insertWebsiteOrder(query, { userId, soldAt, lines }) {
  let subtotal = 0;
  const resolved = [];
  for (const line of lines) {
    const unit = line.variant.price_cents;
    subtotal += unit * line.qty;
    resolved.push({ ...line, unit });
  }
  const shipping = subtotal >= 150000 ? 0 : 5000;
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + shipping + tax;
  const ref = `demo_analytics_${soldAt.getTime()}_${Math.random().toString(36).slice(2, 7)}`;

  const { rows } = await query(
    `INSERT INTO orders (
       user_id, status, subtotal_cents, shipping_cents, tax_cents, total_cents,
       shipping_name, shipping_line1, shipping_city, shipping_state, shipping_zip,
       shipping_country, payment_ref, created_at, updated_at
     ) VALUES (
       $1, 'delivered', $2, $3, $4, $5,
       'Demo Customer', '123 Demo St', 'Yangon', 'Yangon', '11111',
       'MM', $6, $7, $7
     ) RETURNING id`,
    [userId, subtotal, shipping, tax, total, ref, soldAt]
  );
  const orderId = rows[0].id;

  for (const line of resolved) {
    await query(
      `INSERT INTO order_items (
         order_id, product_id, variant_id, product_name, variant_name,
         size, quantity, unit_price_cents
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        orderId,
        line.variant.product_id,
        line.variant.id,
        line.variant.product_name,
        line.variant.color_name,
        line.size,
        line.qty,
        line.unit,
      ]
    );
  }
}

async function insertStoreSale(query, { soldAt, variant, size, qty }) {
  const total = variant.price_cents * qty;
  const { rows } = await query(
    `INSERT INTO store_sales (sold_at, total_cents, notes, created_at)
     VALUES ($1, $2, $3, $1) RETURNING id`,
    [soldAt, total, `${TAG} walk-in`]
  );
  const saleId = rows[0].id;
  await query(
    `INSERT INTO store_sale_items (
       sale_id, variant_id, product_name, variant_name, size,
       quantity, unit_price_cents, unit_cost_cents
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      saleId,
      variant.id,
      variant.product_name,
      variant.color_name,
      size,
      qty,
      variant.price_cents,
      variant.cost_cents,
    ]
  );
}

async function insertIconicTransfer(query, { transferredAt, lines }) {
  const { rows } = await query(
    `INSERT INTO iconic_transfers (transferred_at, from_location, notes, created_at)
     VALUES ($1::date, 'store', $2, $1) RETURNING id`,
    [transferredAt, `${TAG} consignment send`]
  );
  const transferId = rows[0].id;
  for (const line of lines) {
    await query(
      `INSERT INTO iconic_transfer_items (
         transfer_id, variant_id, product_name, variant_name, size, qty_sent
       ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        transferId,
        line.variant.id,
        line.variant.product_name,
        line.variant.color_name,
        line.size,
        line.qty,
      ]
    );
  }
}

async function insertIconicReport(query, { month, lines }) {
  const { rows } = await query(
    `INSERT INTO iconic_sales_reports (report_month, notes, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (report_month) DO UPDATE SET notes = EXCLUDED.notes
     RETURNING id`,
    [month, `${TAG} monthly sold report`]
  );
  const reportId = rows[0].id;

  // Clear prior demo items for this report if re-seeded via ON CONFLICT
  await query(`DELETE FROM iconic_sales_report_items WHERE report_id = $1`, [reportId]);

  for (const line of lines) {
    const unitRevenue = Math.round(line.variant.price_cents * line.revFactor);
    await query(
      `INSERT INTO iconic_sales_report_items (
         report_id, variant_id, product_name, variant_name, size,
         qty_sold, unit_revenue_cents, unit_cost_cents
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        reportId,
        line.variant.id,
        line.variant.product_name,
        line.variant.color_name,
        line.size,
        line.qty,
        unitRevenue,
        line.variant.cost_cents,
      ]
    );
  }
}
