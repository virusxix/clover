/**
 * Analytics + market insights
 * ---------------------------
 * One job: aggregate sales / P&L / inventory health from our own data.
 * No external market feeds — insights are built from Clover + ICONIC numbers.
 */

import { toDisplayAmount } from "../currency.js";

const PERIODS = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
  overall: null,
};

/**
 * Revenue / units / profit for a period across website, store, and ICONIC.
 */
export async function getPeriodSummary(db, period = "monthly") {
  const trunc = PERIODS[period];
  const bucket = trunc
    ? `date_trunc('${trunc}', ts)`
    : `'overall'::text`;

  const { rows } = await db.query(
    `
    WITH sales AS (
      SELECT o.created_at AS ts, 'website'::text AS channel,
             oi.quantity, oi.unit_price_cents AS revenue_unit,
             COALESCE(v.cost_cents, 0) AS cost_unit
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN product_variants v ON v.id = oi.variant_id
      WHERE o.status != 'cancelled'

      UNION ALL

      SELECT s.sold_at, 'store',
             si.quantity, si.unit_price_cents, si.unit_cost_cents
      FROM store_sales s
      JOIN store_sale_items si ON si.sale_id = s.id

      UNION ALL

      SELECT r.report_month::timestamptz, 'iconic',
             ii.qty_sold, ii.unit_revenue_cents, ii.unit_cost_cents
      FROM iconic_sales_reports r
      JOIN iconic_sales_report_items ii ON ii.report_id = r.id
    )
    SELECT
      ${bucket} AS bucket,
      channel,
      SUM(quantity)::int AS units,
      SUM(quantity * revenue_unit)::int AS revenue_cents,
      SUM(quantity * cost_unit)::int AS cost_cents,
      SUM(quantity * (revenue_unit - cost_unit))::int AS profit_cents
    FROM sales
    GROUP BY 1, channel
    ORDER BY 1 DESC NULLS LAST, channel
    `
  );

  return rows.map((r) => ({
    bucket: r.bucket,
    channel: r.channel,
    units: r.units,
    revenue: toDisplayAmount(r.revenue_cents),
    cost: toDisplayAmount(r.cost_cents),
    profit: toDisplayAmount(r.profit_cents),
    revenueCents: r.revenue_cents,
    costCents: r.cost_cents,
    profitCents: r.profit_cents,
  }));
}

/** Combined totals + annual P&L rows. */
export async function getProfitLoss(db) {
  const rows = await getPeriodSummary(db, "yearly");
  const byYear = {};

  for (const r of rows) {
    const year = r.bucket ? new Date(r.bucket).getUTCFullYear() : "overall";
    if (!byYear[year]) {
      byYear[year] = {
        year,
        website: emptyChannel(),
        store: emptyChannel(),
        iconic: emptyChannel(),
        overall: emptyChannel(),
      };
    }
    const ch = byYear[year][r.channel];
    if (ch) addChannel(ch, r);
    addChannel(byYear[year].overall, r);
  }

  return Object.values(byYear).sort((a, b) => String(b.year).localeCompare(String(a.year)));
}

function emptyChannel() {
  return { units: 0, revenue: 0, cost: 0, profit: 0 };
}

function addChannel(target, row) {
  target.units += row.units;
  target.revenue += row.revenue;
  target.cost += row.cost;
  target.profit += row.profit;
}

/**
 * Expert-style market insights from internal sales + stock.
 * Designed for owners: what sells, what's stuck, channel mix, sell-through.
 */
export async function getMarketInsights(db) {
  const [top, slow, channelMix, categoryMix, stockHealth, sellThrough] = await Promise.all([
    topMovers(db),
    slowMovers(db),
    channelShare(db),
    categoryShare(db),
    stockByLocation(db),
    sellThroughRates(db),
  ]);

  return {
    narrative: buildNarrative({ top, slow, channelMix, stockHealth }),
    topMovers: top,
    slowMovers: slow,
    channelMix,
    categoryMix,
    stockHealth,
    sellThrough,
  };
}

async function topMovers(db) {
  const { rows } = await db.query(
    `
    SELECT product_name, SUM(qty)::int AS units, SUM(rev)::int AS revenue_cents
    FROM (
      SELECT oi.product_name, oi.quantity AS qty, oi.quantity * oi.unit_price_cents AS rev
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
        AND o.created_at >= NOW() - INTERVAL '90 days'
      UNION ALL
      SELECT si.product_name, si.quantity, si.quantity * si.unit_price_cents
      FROM store_sale_items si
      JOIN store_sales s ON s.id = si.sale_id AND s.sold_at >= NOW() - INTERVAL '90 days'
      UNION ALL
      SELECT ii.product_name, ii.qty_sold, ii.qty_sold * ii.unit_revenue_cents
      FROM iconic_sales_report_items ii
      JOIN iconic_sales_reports r ON r.id = ii.report_id
        AND r.report_month >= (CURRENT_DATE - INTERVAL '90 days')
    ) x
    GROUP BY product_name
    ORDER BY units DESC
    LIMIT 8
    `
  );
  return rows.map((r) => ({
    name: r.product_name,
    units: r.units,
    revenue: toDisplayAmount(r.revenue_cents),
  }));
}

async function slowMovers(db) {
  const { rows } = await db.query(
    `
    SELECT p.name, v.color_name, il.size, il.location_id, il.qty,
           v.price_cents, v.cost_cents
    FROM inventory_levels il
    JOIN product_variants v ON v.id = il.variant_id
    JOIN products p ON p.id = v.product_id
    WHERE il.qty > 0
      AND NOT EXISTS (
        SELECT 1 FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
          AND o.created_at >= NOW() - INTERVAL '45 days'
        WHERE oi.variant_id = il.variant_id AND oi.size = il.size
      )
      AND NOT EXISTS (
        SELECT 1 FROM store_sale_items si
        JOIN store_sales s ON s.id = si.sale_id AND s.sold_at >= NOW() - INTERVAL '45 days'
        WHERE si.variant_id = il.variant_id AND si.size = il.size
      )
      AND NOT EXISTS (
        SELECT 1 FROM iconic_sales_report_items ii
        JOIN iconic_sales_reports r ON r.id = ii.report_id
          AND r.report_month >= (CURRENT_DATE - INTERVAL '45 days')
        WHERE ii.variant_id = il.variant_id AND ii.size = il.size
      )
    ORDER BY il.qty DESC
    LIMIT 12
    `
  );
  return rows.map((r) => ({
    name: r.name,
    color: r.color_name,
    size: r.size,
    location: r.location_id,
    qty: r.qty,
    tiedUp: toDisplayAmount(r.qty * r.cost_cents),
  }));
}

async function channelShare(db) {
  const { rows } = await db.query(
    `
    SELECT channel, SUM(rev)::int AS revenue_cents, SUM(units)::int AS units
    FROM (
      SELECT 'website' AS channel, oi.quantity AS units, oi.quantity * oi.unit_price_cents AS rev
      FROM order_items oi JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
      UNION ALL
      SELECT 'store', si.quantity, si.quantity * si.unit_price_cents
      FROM store_sale_items si
      UNION ALL
      SELECT 'iconic', ii.qty_sold, ii.qty_sold * ii.unit_revenue_cents
      FROM iconic_sales_report_items ii
    ) x
    GROUP BY channel
    `
  );
  const total = rows.reduce((s, r) => s + r.revenue_cents, 0) || 1;
  return rows.map((r) => ({
    channel: r.channel,
    units: r.units,
    revenue: toDisplayAmount(r.revenue_cents),
    sharePct: Math.round((r.revenue_cents / total) * 100),
  }));
}

async function categoryShare(db) {
  const { rows } = await db.query(
    `
    SELECT COALESCE(c.label, 'Uncategorized') AS category,
           SUM(oi.quantity)::int AS units,
           SUM(oi.quantity * oi.unit_price_cents)::int AS revenue_cents
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    GROUP BY 1
    ORDER BY revenue_cents DESC
    LIMIT 10
    `
  );
  return rows.map((r) => ({
    category: r.category,
    units: r.units,
    revenue: toDisplayAmount(r.revenue_cents),
  }));
}

async function stockByLocation(db) {
  const { rows } = await db.query(
    `
    SELECT location_id,
           SUM(qty)::int AS units,
           SUM(qty * v.cost_cents)::int AS cost_cents
    FROM inventory_levels il
    JOIN product_variants v ON v.id = il.variant_id
    GROUP BY location_id
    ORDER BY location_id
    `
  );
  return rows.map((r) => ({
    location: r.location_id,
    units: r.units,
    inventoryValue: toDisplayAmount(r.cost_cents),
  }));
}

async function sellThroughRates(db) {
  const { rows } = await db.query(
    `
    WITH sold AS (
      SELECT variant_id, size, SUM(qty)::int AS sold_qty
      FROM (
        SELECT oi.variant_id, oi.size, oi.quantity AS qty
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
          AND o.created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT si.variant_id, si.size, si.quantity
        FROM store_sale_items si
        JOIN store_sales s ON s.id = si.sale_id AND s.sold_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT ii.variant_id, ii.size, ii.qty_sold
        FROM iconic_sales_report_items ii
        JOIN iconic_sales_reports r ON r.id = ii.report_id
          AND r.report_month >= (CURRENT_DATE - INTERVAL '30 days')
      ) x
      GROUP BY variant_id, size
    ),
    on_hand AS (
      SELECT variant_id, size, SUM(qty)::int AS stock_qty
      FROM inventory_levels GROUP BY variant_id, size
    )
    SELECT p.name, v.color_name, s.size,
           COALESCE(s.sold_qty, 0) AS sold_qty,
           COALESCE(h.stock_qty, 0) AS stock_qty,
           CASE
             WHEN COALESCE(s.sold_qty,0) + COALESCE(h.stock_qty,0) = 0 THEN 0
             ELSE ROUND(
               100.0 * COALESCE(s.sold_qty,0) /
               (COALESCE(s.sold_qty,0) + COALESCE(h.stock_qty,0))
             )::int
           END AS sell_through_pct
    FROM sold s
    JOIN product_variants v ON v.id = s.variant_id
    JOIN products p ON p.id = v.product_id
    LEFT JOIN on_hand h ON h.variant_id = s.variant_id AND h.size = s.size
    ORDER BY sell_through_pct DESC
    LIMIT 10
    `
  );
  return rows.map((r) => ({
    name: r.name,
    color: r.color_name,
    size: r.size,
    sold: r.sold_qty,
    onHand: r.stock_qty,
    sellThroughPct: r.sell_through_pct,
  }));
}

function buildNarrative({ top, slow, channelMix, stockHealth }) {
  const lines = [];
  if (top[0]) {
    lines.push(
      `Best seller (90d): ${top[0].name} — ${top[0].units} units, ${formatRough(top[0].revenue)} revenue.`
    );
  }
  const web = channelMix.find((c) => c.channel === "website");
  const store = channelMix.find((c) => c.channel === "store");
  const iconic = channelMix.find((c) => c.channel === "iconic");
  if (web || store || iconic) {
    lines.push(
      `Channel mix: Website ${web?.sharePct ?? 0}% · Store ${store?.sharePct ?? 0}% · ICONIC ${iconic?.sharePct ?? 0}%.`
    );
  }
  if (slow[0]) {
    lines.push(
      `${slow.length} slow SKUs (no sales in 45 days). Largest: ${slow[0].name} (${slow[0].qty} at ${slow[0].location}).`
    );
  }
  const iconicStock = stockHealth.find((s) => s.location === "iconic");
  if (iconicStock?.units) {
    lines.push(
      `ICONIC holds ${iconicStock.units} units (cost value ${formatRough(iconicStock.inventoryValue)}) awaiting monthly sell-through.`
    );
  }
  if (!lines.length) {
    lines.push("Not enough sales history yet — record store sales and ICONIC monthly reports to unlock insights.");
  }
  return lines;
}

function formatRough(n) {
  if (typeof n !== "number") return String(n);
  return `${Math.round(n).toLocaleString()} Ks`;
}
