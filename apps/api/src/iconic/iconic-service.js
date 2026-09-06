/**
 * ICONIC partner stock
 * --------------------
 * One job: send stock to ICONIC (consignment) and record their monthly sold report.
 * Transfers always leave the physical store → ICONIC (real-world handoff).
 * Monthly report deducts ICONIC location stock and books revenue for P&L.
 */

import { getPool } from "../pg-pool.js";
import { LOCATIONS } from "../inventory/locations.js";
import { transferStock, adjustStock } from "../inventory/stock-service.js";

/**
 * Transfer stock from store → ICONIC (always; website stock is never the source).
 * @param {{ items: Array<{ variantId, size, qty }>, transferredAt?, notes?, createdBy? }}
 */
export async function createIconicTransfer({
  items,
  transferredAt = new Date(),
  notes = "",
  createdBy = null,
}) {
  if (!items?.length) {
    const err = new Error("Transfer needs at least one item");
    err.status = 400;
    throw err;
  }

  const fromLocation = LOCATIONS.STORE;

  const client = await getPool().then((p) => p.connect());
  try {
    await client.query("BEGIN");

    const { rows: tRows } = await client.query(
      `INSERT INTO iconic_transfers (transferred_at, from_location, notes, created_by)
       VALUES ($1::date, $2, $3, $4) RETURNING id`,
      [transferredAt, fromLocation, notes, createdBy]
    );
    const transferId = tRows[0].id;

    for (const line of items) {
      const { rows } = await client.query(
        `SELECT v.id, v.color_name, p.name
         FROM product_variants v JOIN products p ON p.id = v.product_id
         WHERE v.id = $1`,
        [line.variantId]
      );
      if (!rows.length) {
        const err = new Error("Variant not found");
        err.status = 404;
        throw err;
      }
      const v = rows[0];

      await client.query(
        `INSERT INTO iconic_transfer_items (
           transfer_id, variant_id, product_name, variant_name, size, qty_sent
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [transferId, v.id, v.name, v.color_name, line.size, line.qty]
      );

      await transferStock(client, {
        variantId: v.id,
        size: line.size,
        qty: line.qty,
        fromLocation,
        toLocation: LOCATIONS.ICONIC,
        reason: "transfer_to_iconic",
        refType: "iconic_transfer",
        refId: transferId,
        notes,
        createdBy,
      });
    }

    await client.query("COMMIT");
    return { transferId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Enter ICONIC's monthly sold report.
 * reportMonth = first day of that month (YYYY-MM-01).
 * unitRevenue = what Clover receives per unit from ICONIC.
 * Idempotent: rejecting a month that already has a report (no double stock deduct).
 */
export async function createIconicSalesReport({
  reportMonth,
  items,
  notes = "",
  createdBy = null,
}) {
  if (!items?.length) {
    const err = new Error("Report needs at least one sold line");
    err.status = 400;
    throw err;
  }

  const monthDate = normalizeMonth(reportMonth);
  const client = await getPool().then((p) => p.connect());

  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      `SELECT id FROM iconic_sales_reports WHERE report_month = $1 FOR UPDATE`,
      [monthDate]
    );
    if (existing.length) {
      const err = new Error("A report for that month already exists — edit is not supported (would double-deduct stock)");
      err.status = 409;
      throw err;
    }

    const { rows: rRows } = await client.query(
      `INSERT INTO iconic_sales_reports (report_month, notes, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [monthDate, notes, createdBy]
    );
    const reportId = rRows[0].id;

    for (const line of items) {
      const { rows } = await client.query(
        `SELECT v.id, v.color_name, v.cost_cents, p.name
         FROM product_variants v JOIN products p ON p.id = v.product_id
         WHERE v.id = $1`,
        [line.variantId]
      );
      if (!rows.length) {
        const err = new Error("Variant not found");
        err.status = 404;
        throw err;
      }
      const v = rows[0];

      await client.query(
        `INSERT INTO iconic_sales_report_items (
           report_id, variant_id, product_name, variant_name, size,
           qty_sold, unit_revenue_cents, unit_cost_cents
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          reportId,
          v.id,
          v.name,
          v.color_name,
          line.size,
          line.qtySold,
          line.unitRevenue,
          v.cost_cents,
        ]
      );

      await adjustStock(client, {
        variantId: v.id,
        locationId: LOCATIONS.ICONIC,
        size: line.size,
        delta: -line.qtySold,
        reason: "sale_iconic",
        refType: "iconic_report",
        refId: reportId,
        createdBy,
        fromLocation: LOCATIONS.ICONIC,
        toLocation: null,
      });
    }

    await client.query("COMMIT");
    return { reportId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") {
      const e = new Error("A report for that month already exists");
      e.status = 409;
      throw e;
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Accept YYYY-MM (from <input type="month">) or YYYY-MM-DD → first of month.
 * @param {string|Date} input
 */
function normalizeMonth(input) {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return `${input.getUTCFullYear()}-${String(input.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }

  const raw = String(input || "").trim();
  const ym = raw.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }

  const err = new Error("Invalid report month — pick a month (YYYY-MM)");
  err.status = 400;
  throw err;
}

export async function listIconicTransfers(db, { limit = 40 } = {}) {
  const { rows } = await db.query(
    `SELECT t.*,
       COALESCE(SUM(i.qty_sent),0)::int AS units_sent
     FROM iconic_transfers t
     LEFT JOIN iconic_transfer_items i ON i.transfer_id = t.id
     GROUP BY t.id
     ORDER BY t.transferred_at DESC, t.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function listIconicReports(db, { limit = 24 } = {}) {
  const { rows } = await db.query(
    `SELECT r.*,
       COALESCE(SUM(i.qty_sold),0)::int AS units_sold,
       COALESCE(SUM(i.qty_sold * i.unit_revenue_cents),0)::int AS revenue_cents
     FROM iconic_sales_reports r
     LEFT JOIN iconic_sales_report_items i ON i.report_id = r.id
     GROUP BY r.id
     ORDER BY r.report_month DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}
