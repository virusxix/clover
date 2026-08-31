/**
 * Admin ops routes
 * ----------------
 * Inventory, store POS, ICONIC, analytics, Excel CSV export.
 * Mounted at /api/admin (auth already applied by parent or here).
 */

import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { toDisplayAmount } from "../currency.js";
import { listInventory, adjustStock, transferStock } from "../inventory/stock-service.js";
import { getPool } from "../pg-pool.js";
import {
  createStoreSale,
  listStoreSales,
  getStoreSaleById,
} from "../store-sales/store-sales-service.js";
import {
  createIconicTransfer,
  createIconicSalesReport,
  listIconicTransfers,
  listIconicReports,
} from "../iconic/iconic-service.js";
import {
  getPeriodSummary,
  getProfitLoss,
  getMarketInsights,
} from "../analytics/analytics-service.js";
import { toCsv, csvResponse } from "../export/csv-export.js";

const router = Router();
router.use(requireAuth, requireAdmin);

const SIZES = ["XS", "S", "M", "L", "XL"];

/** GET /api/admin/ops/variants — catalog variants for admin pickers (no UUID typing) */
router.get("/variants", async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT v.id AS variant_id, p.name AS product_name, p.product_code,
              v.color_name, v.price_cents, v.cost_cents
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       ORDER BY p.name, v.color_name`
    );
    res.json({
      variants: rows.map((r) => ({
        variantId: r.variant_id,
        productName: r.product_name,
        productCode: r.product_code,
        colorName: r.color_name,
        price: toDisplayAmount(r.price_cents),
        cost: toDisplayAmount(r.cost_cents),
        sizes: SIZES,
      })),
    });
  } catch (err) {
    console.error("[ops/variants]", err);
    res.status(500).json({ error: "Failed to load variants" });
  }
});

// ─── Inventory ────────────────────────────────────────────────

/** GET /api/admin/ops/inventory */
router.get("/inventory", async (req, res) => {
  try {
    const rows = await listInventory({ query }, {
      locationId: req.query.location || null,
      q: req.query.q || "",
    });
    res.json({
      items: rows.map((r) => ({
        variantId: r.variant_id,
        productId: r.product_id,
        productName: r.product_name,
        productCode: r.product_code,
        slug: r.slug,
        colorName: r.color_name,
        size: r.size,
        locationId: r.location_id,
        qty: r.qty,
        price: toDisplayAmount(r.price_cents),
        cost: toDisplayAmount(r.cost_cents),
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    console.error("[ops/inventory]", err);
    res.status(500).json({ error: "Failed to load inventory" });
  }
});

/** POST /api/admin/ops/inventory/adjust — receive / correct stock at a location */
router.post("/inventory/adjust", async (req, res) => {
  const parsed = z
    .object({
      variantId: z.string().uuid(),
      locationId: z.enum(["website", "store", "iconic"]),
      size: z.string().min(1).max(8),
      delta: z.coerce.number().int().refine((n) => n !== 0),
      notes: z.string().max(500).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid adjust payload",
      hint: "Pick a product from the list (full variant id required)",
      details: parsed.error.flatten(),
    });
  }

  const client = await getPool().then((p) => p.connect());
  try {
    await client.query("BEGIN");
    await adjustStock(client, {
      ...parsed.data,
      reason: parsed.data.delta > 0 ? "receive" : "adjust",
      createdBy: req.user.id,
      toLocation: parsed.data.delta > 0 ? parsed.data.locationId : null,
      fromLocation: parsed.data.delta < 0 ? parsed.data.locationId : null,
    });
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(err.status || 500).json({ error: err.message || "Adjust failed" });
  } finally {
    client.release();
  }
});

/** POST /api/admin/ops/inventory/transfer — move between website ↔ store */
router.post("/inventory/transfer", async (req, res) => {
  const parsed = z
    .object({
      variantId: z.string().uuid(),
      size: z.string().min(1).max(8),
      qty: z.coerce.number().int().positive(),
      fromLocation: z.enum(["website", "store"]),
      toLocation: z.enum(["website", "store"]),
      notes: z.string().max(500).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid transfer payload",
      hint: "Select a product from the dropdown — truncated IDs are rejected",
      details: parsed.error.flatten(),
    });
  }
  if (parsed.data.fromLocation === parsed.data.toLocation) {
    return res.status(400).json({ error: "from and to must differ" });
  }

  const client = await getPool().then((p) => p.connect());
  try {
    await client.query("BEGIN");
    await transferStock(client, {
      ...parsed.data,
      reason: "transfer_internal",
      createdBy: req.user.id,
    });
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(err.status || 500).json({ error: err.message || "Transfer failed" });
  } finally {
    client.release();
  }
});

// ─── Store POS ────────────────────────────────────────────────

router.get("/store-sales", async (_req, res) => {
  try {
    const rows = await listStoreSales({ query });
    res.json({
      sales: rows.map((s) => ({
        id: s.id,
        soldAt: s.sold_at,
        total: toDisplayAmount(s.total_cents),
        notes: s.notes,
        unitCount: s.unit_count,
      })),
    });
  } catch (err) {
    console.error("[ops/store-sales]", err);
    res.status(500).json({ error: "Failed to load store sales" });
  }
});

router.get("/store-sales/:id", async (req, res) => {
  try {
    const sale = await getStoreSaleById({ query }, req.params.id);
    if (!sale) return res.status(404).json({ error: "Sale not found" });
    res.json({
      sale: {
        saleId: sale.saleId,
        soldAt: sale.soldAt,
        total: toDisplayAmount(sale.total),
        notes: sale.notes,
        paymentMethod: sale.paymentMethod,
        items: sale.items.map((i) => ({
          variantId: i.variantId,
          productName: i.productName,
          productCode: i.productCode,
          colorName: i.variantName,
          size: i.size,
          quantity: i.quantity,
          unitPrice: toDisplayAmount(i.unitPrice),
          lineTotal: toDisplayAmount(i.unitPrice * i.quantity),
        })),
      },
    });
  } catch (err) {
    console.error("[ops/store-sales/:id]", err);
    res.status(500).json({ error: "Failed to load sale" });
  }
});

router.post("/store-sales", async (req, res) => {
  const parsed = z
    .object({
      notes: z.string().max(500).optional(),
      soldAt: z.string().datetime().optional(),
      paymentMethod: z.enum(["cash", "card", "transfer", "other"]).default("cash"),
      items: z
        .array(
          z.object({
            variantId: z.string().uuid(),
            size: z.string().min(1).max(8),
            quantity: z.coerce.number().int().positive(),
            unitPrice: z.coerce.number().int().positive().optional(),
          })
        )
        .min(1),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid sale payload",
      hint: "Add at least one product to the cart",
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await createStoreSale({
      items: parsed.data.items,
      notes: parsed.data.notes || "",
      paymentMethod: parsed.data.paymentMethod,
      soldAt: parsed.data.soldAt ? new Date(parsed.data.soldAt) : new Date(),
      createdBy: req.user.id,
    });
    res.status(201).json({
      saleId: result.saleId,
      soldAt: result.soldAt,
      total: toDisplayAmount(result.total),
      notes: result.notes,
      paymentMethod: result.paymentMethod,
      items: result.items.map((i) => ({
        variantId: i.variantId,
        productName: i.productName,
        productCode: i.productCode,
        colorName: i.variantName,
        size: i.size,
        quantity: i.quantity,
        unitPrice: toDisplayAmount(i.unitPrice),
        lineTotal: toDisplayAmount(i.unitPrice * i.quantity),
      })),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Sale failed" });
  }
});

// ─── ICONIC ───────────────────────────────────────────────────

router.get("/iconic/transfers", async (_req, res) => {
  try {
    const rows = await listIconicTransfers({ query });
    res.json({
      transfers: rows.map((t) => ({
        id: t.id,
        transferredAt: t.transferred_at,
        fromLocation: t.from_location,
        notes: t.notes,
        unitsSent: t.units_sent,
      })),
    });
  } catch (err) {
    console.error("[ops/iconic/transfers]", err);
    res.status(500).json({ error: "Failed to load transfers" });
  }
});

router.post("/iconic/transfers", async (req, res) => {
  const parsed = z
    .object({
      transferredAt: z.string().optional(),
      notes: z.string().max(500).optional(),
      items: z
        .array(
          z.object({
            variantId: z.string().uuid(),
            size: z.string().min(1).max(8),
            qty: z.coerce.number().int().positive(),
          })
        )
        .min(1),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid transfer payload",
      hint: "Select a product from the dropdown",
      details: parsed.error.flatten(),
    });
  }

  try {
    // Always store → ICONIC (physical consignment from the shop)
    const result = await createIconicTransfer({
      ...parsed.data,
      createdBy: req.user.id,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Transfer failed" });
  }
});

router.get("/iconic/reports", async (_req, res) => {
  try {
    const rows = await listIconicReports({ query });
    res.json({
      reports: rows.map((r) => ({
        id: r.id,
        reportMonth: r.report_month,
        notes: r.notes,
        unitsSold: r.units_sold,
        revenue: toDisplayAmount(r.revenue_cents),
      })),
    });
  } catch (err) {
    console.error("[ops/iconic/reports]", err);
    res.status(500).json({ error: "Failed to load reports" });
  }
});

router.post("/iconic/reports", async (req, res) => {
  const parsed = z
    .object({
      reportMonth: z.string().min(7),
      notes: z.string().max(500).optional(),
      items: z
        .array(
          z.object({
            variantId: z.string().uuid(),
            size: z.string().min(1).max(8),
            qtySold: z.coerce.number().int().positive(),
            unitRevenue: z.coerce.number().int().nonnegative(),
          })
        )
        .min(1),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid report payload" });

  try {
    const result = await createIconicSalesReport({
      ...parsed.data,
      createdBy: req.user.id,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Report failed" });
  }
});

// ─── Analytics ────────────────────────────────────────────────

router.get("/analytics/summary", async (req, res) => {
  const period = String(req.query.period || "monthly");
  if (!["daily", "weekly", "monthly", "yearly", "overall"].includes(period)) {
    return res.status(400).json({ error: "Invalid period" });
  }
  try {
    const rows = await getPeriodSummary({ query }, period);
    res.json({ period, rows });
  } catch (err) {
    console.error("[ops/analytics]", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

router.get("/analytics/profit-loss", async (_req, res) => {
  try {
    const years = await getProfitLoss({ query });
    res.json({ years });
  } catch (err) {
    console.error("[ops/pl]", err);
    res.status(500).json({ error: "Failed to load P&L" });
  }
});

router.get("/analytics/market", async (_req, res) => {
  try {
    const insights = await getMarketInsights({ query });
    res.json(insights);
  } catch (err) {
    console.error("[ops/market]", err);
    res.status(500).json({ error: "Failed to load market insights" });
  }
});

// ─── Excel CSV export ─────────────────────────────────────────

router.get("/export/:kind", async (req, res) => {
  const kind = req.params.kind;
  try {
    if (kind === "inventory") {
      const rows = await listInventory({ query }, {});
      const csv = toCsv(
        ["Product", "Color", "Size", "Location", "Qty", "Price", "Cost"],
        rows,
        (r) => [
          r.product_name,
          r.color_name,
          r.size,
          r.location_id,
          r.qty,
          r.price_cents,
          r.cost_cents,
        ]
      );
      return csvResponse(res, "clover-inventory.csv", csv);
    }

    if (kind === "sales-summary") {
      const rows = await getPeriodSummary({ query }, "monthly");
      const csv = toCsv(
        ["Bucket", "Channel", "Units", "Revenue", "Cost", "Profit"],
        rows,
        (r) => [r.bucket, r.channel, r.units, r.revenue, r.cost, r.profit]
      );
      return csvResponse(res, "clover-sales-summary.csv", csv);
    }

    if (kind === "profit-loss") {
      const years = await getProfitLoss({ query });
      const flat = [];
      for (const y of years) {
        for (const channel of ["website", "store", "iconic", "overall"]) {
          const c = y[channel];
          flat.push({
            year: y.year,
            channel,
            units: c.units,
            revenue: c.revenue,
            cost: c.cost,
            profit: c.profit,
          });
        }
      }
      const csv = toCsv(
        ["Year", "Channel", "Units", "Revenue", "Cost", "Profit"],
        flat,
        (r) => [r.year, r.channel, r.units, r.revenue, r.cost, r.profit]
      );
      return csvResponse(res, "clover-profit-loss.csv", csv);
    }

    if (kind === "iconic") {
      const rows = await listIconicReports({ query }, { limit: 120 });
      const csv = toCsv(
        ["Month", "UnitsSold", "Revenue", "Notes"],
        rows,
        (r) => [r.report_month, r.units_sold, r.revenue_cents, r.notes]
      );
      return csvResponse(res, "clover-iconic-reports.csv", csv);
    }

    return res.status(404).json({ error: "Unknown export kind" });
  } catch (err) {
    console.error("[ops/export]", err);
    res.status(500).json({ error: "Export failed" });
  }
});

export default router;
