/**
 * Ops routes
 * ----------
 * Floor (admin + reception): inventory, POS, ICONIC, customers.
 * Owner (admin only): analytics + CSV export.
 * Mounted at /api/admin/ops — must be registered before the catch-all admin router.
 */

import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireAdmin, requireStoreStaff } from "../middleware/auth.js";
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
import {
  listCustomers,
  createCustomer,
  updateCustomer,
} from "../customers/customer-service.js";
import { auditFromReq } from "../audit.js";

const router = Router();
router.use(requireAuth);
// Analytics/export → admin only; floor ops → admin or reception.
router.use((req, res, next) => {
  if (req.path.startsWith("/analytics") || req.path.startsWith("/export")) {
    return requireAdmin(req, res, next);
  }
  return requireStoreStaff(req, res, next);
});

const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

function hideCosts(role) {
  return role === "reception";
}

/** GET /api/admin/ops/variants — catalog variants for admin pickers (no UUID typing) */
router.get("/variants", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT v.id AS variant_id, p.name AS product_name, p.product_code,
              v.color_name, v.price_cents, v.cost_cents
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       ORDER BY p.name, v.color_name`
    );
    res.json({
      variants: rows.map((r) => {
        const base = {
          variantId: r.variant_id,
          productName: r.product_name,
          productCode: r.product_code,
          colorName: r.color_name,
          price: toDisplayAmount(r.price_cents),
          sizes: SIZES,
        };
        if (!hideCosts(req.user?.role)) {
          base.cost = toDisplayAmount(r.cost_cents);
        }
        return base;
      }),
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
      items: rows.map((r) => {
        const base = {
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
          updatedAt: r.updated_at,
        };
        if (!hideCosts(req.user?.role)) {
          base.cost = toDisplayAmount(r.cost_cents);
        }
        return base;
      }),
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
    await auditFromReq(req, "inventory_adjust", "variant", parsed.data.variantId, {
      locationId: parsed.data.locationId,
      size: parsed.data.size,
      delta: parsed.data.delta,
    });
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
    await auditFromReq(req, "inventory_transfer", "variant", parsed.data.variantId, {
      size: parsed.data.size,
      qty: parsed.data.qty,
      from: parsed.data.fromLocation,
      to: parsed.data.toLocation,
    });
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
        discount: toDisplayAmount(s.discount_cents || 0),
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
        subtotal: toDisplayAmount(sale.subtotal),
        itemDiscount: toDisplayAmount(sale.itemDiscount || 0),
        discount: toDisplayAmount(sale.discount || 0),
        total: toDisplayAmount(sale.total),
        notes: sale.notes,
        paymentMethod: sale.paymentMethod,
        channel: "store",
        items: sale.items.map((i) => ({
          variantId: i.variantId,
          productName: i.productName,
          productCode: i.productCode,
          colorName: i.variantName,
          size: i.size,
          quantity: i.quantity,
          unitPrice: toDisplayAmount(i.unitPrice),
          discount: toDisplayAmount(i.discount || 0),
          lineTotal: toDisplayAmount(i.lineTotal),
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
      paymentMethod: z.enum(["cash", "kbzpay", "mmqr", "card"]).default("cash"),
      customerId: z.string().uuid().optional().nullable(),
      /** Seller discount in MMK (whole units), applied to the cart subtotal */
      discount: z.coerce.number().int().min(0).max(50_000_000).optional().default(0),
      items: z
        .array(
          z.object({
            variantId: z.string().uuid(),
            size: z.string().min(1).max(8),
            quantity: z.coerce.number().int().positive(),
            unitPrice: z.coerce.number().int().positive().optional(),
            discount: z.coerce.number().int().min(0).max(50_000_000).optional().default(0),
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
      discount: parsed.data.discount,
      customerId: parsed.data.customerId || null,
      soldAt: parsed.data.soldAt ? new Date(parsed.data.soldAt) : new Date(),
      createdBy: req.user.id,
    });
    await auditFromReq(req, "store_sale", "store_sale", result.saleId, {
      total: result.total,
      paymentMethod: result.paymentMethod,
      itemCount: result.items?.length || 0,
    });
    res.status(201).json({
      saleId: result.saleId,
      soldAt: result.soldAt,
      subtotal: toDisplayAmount(result.subtotal),
      itemDiscount: toDisplayAmount(result.itemDiscount || 0),
      discount: toDisplayAmount(result.discount),
      total: toDisplayAmount(result.total),
      notes: result.notes,
      paymentMethod: result.paymentMethod,
      customerId: result.customerId || null,
      channel: "store",
      items: result.items.map((i) => ({
        variantId: i.variantId,
        productName: i.productName,
        productCode: i.productCode,
        colorName: i.variantName,
        size: i.size,
        quantity: i.quantity,
        unitPrice: toDisplayAmount(i.unitPrice),
        discount: toDisplayAmount(i.discount || 0),
        lineTotal: toDisplayAmount(i.lineTotal),
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
    await auditFromReq(req, "iconic_transfer", "iconic_transfer", result.transferId, {
      itemCount: parsed.data.items.length,
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
    await auditFromReq(req, "iconic_report", "iconic_sales_report", result.reportId, {
      reportMonth: parsed.data.reportMonth,
      itemCount: parsed.data.items.length,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Report failed" });
  }
});

// ─── Analytics (owner only — profit / P&L / exports) ──────────

// ─── Customers (loyalty CRM) ──────────────────────────────────

router.get("/customers", async (req, res) => {
  try {
    const rows = await listCustomers(
      { query },
      {
        q: typeof req.query.q === "string" ? req.query.q : "",
        segment: typeof req.query.segment === "string" ? req.query.segment : "",
      }
    );
    res.json({
      customers: rows.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        segment: c.segment,
        notes: c.notes,
        userId: c.user_id,
        orderCount: c.order_count || 0,
        storeSaleCount: c.store_sale_count || 0,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  } catch (err) {
    console.error("[ops/customers]", err);
    res.status(500).json({ error: "Failed to load customers" });
  }
});

router.post("/customers", async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(1).max(120),
      phone: z.string().max(32).optional().nullable(),
      email: z.string().email().max(255).optional().nullable().or(z.literal("")),
      segment: z.enum(["new", "regular", "loyal", "vip"]).optional(),
      notes: z.string().max(2000).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid customer", details: parsed.error.flatten() });
  }
  try {
    const c = await createCustomer({ query }, {
      ...parsed.data,
      email: parsed.data.email || null,
    });
    await auditFromReq(req, "customer_create", "customer", c.id, {
      name: c.name,
      segment: c.segment,
    });
    res.status(201).json({
      customer: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        segment: c.segment,
        notes: c.notes,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to create customer" });
  }
});

router.patch("/customers/:id", async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(1).max(120).optional(),
      phone: z.string().max(32).optional().nullable(),
      email: z.string().email().max(255).optional().nullable().or(z.literal("")),
      segment: z.enum(["new", "regular", "loyal", "vip"]).optional(),
      notes: z.string().max(2000).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid customer update", details: parsed.error.flatten() });
  }
  try {
    const data = { ...parsed.data };
    if (data.email === "") data.email = null;
    const c = await updateCustomer({ query }, req.params.id, data);
    await auditFromReq(req, "customer_update", "customer", c.id, {
      fields: Object.keys(parsed.data),
    });
    res.json({
      customer: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        segment: c.segment,
        notes: c.notes,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed to update customer" });
  }
});

router.get("/analytics/summary", requireAdmin, async (req, res) => {
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

router.get("/analytics/profit-loss", requireAdmin, async (_req, res) => {
  try {
    const years = await getProfitLoss({ query });
    res.json({ years });
  } catch (err) {
    console.error("[ops/pl]", err);
    res.status(500).json({ error: "Failed to load P&L" });
  }
});

router.get("/analytics/market", requireAdmin, async (_req, res) => {
  try {
    const insights = await getMarketInsights({ query });
    res.json(insights);
  } catch (err) {
    console.error("[ops/market]", err);
    res.status(500).json({ error: "Failed to load market insights" });
  }
});

// ─── Excel CSV export ─────────────────────────────────────────

router.get("/export/:kind", requireAdmin, async (req, res) => {
  const kind = req.params.kind;
  try {
    await auditFromReq(req, "export", "export", kind, { kind });
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
