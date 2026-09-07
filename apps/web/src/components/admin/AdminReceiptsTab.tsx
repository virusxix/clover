"use client";

/**
 * Admin Receipts
 * --------------
 * Owner-only edit/delete for store POS receipts. Same store_sales rows reception
 * reprints — edits here show up on the floor immediately.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";
import { POS_PAYMENT_METHODS, type PosPaymentMethod } from "@/lib/payments";
import {
  ADMIN_SIZES,
  VariantStockPicker,
  variantsFromCatalog,
  type CatalogVariant,
} from "@/components/admin/VariantStockPicker";
import {
  loadPaperWidth,
  printReceipt,
  type ReceiptData,
} from "@/components/admin/pos/PosReceipt";

type SaleRow = {
  id: string;
  soldAt: string;
  total: number;
  discount: number;
  notes: string;
  unitCount: number;
};

type EditLine = {
  key: string;
  variantId: string;
  productName: string;
  colorName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

const field =
  "w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm min-h-[44px] bg-white/70";

function lineKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AdminReceiptsTab() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [soldAt, setSoldAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<CatalogVariant[]>([]);
  const [addVariantId, setAddVariantId] = useState("");
  const [addSize, setAddSize] = useState<string>(ADMIN_SIZES[2]);
  const [addPrice, setAddPrice] = useState(0);

  const pickerVariants = useMemo(() => variantsFromCatalog(catalog), [catalog]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<{ sales: SaleRow[] }>("/api/admin/ops/store-sales?limit=100"),
      api<{ variants: CatalogVariant[] }>("/api/admin/ops/variants"),
    ])
      .then(([s, v]) => {
        setSales(s.sales || []);
        setCatalog(v.variants || []);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load receipts"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cartGross = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const lineDiscountTotal = lines.reduce((s, l) => {
    const max = l.unitPrice * l.quantity;
    return s + Math.min(max, Math.max(0, Math.round(l.discount || 0)));
  }, 0);
  const afterLines = cartGross - lineDiscountTotal;
  const orderDisc = Math.min(afterLines, Math.max(0, Math.round(orderDiscount || 0)));
  const due = Math.max(0, afterLines - orderDisc);

  const openEdit = async (id: string) => {
    setError("");
    setMsg("");
    try {
      const res = await api<{ sale: ReceiptData & { notes?: string } }>(
        `/api/admin/ops/store-sales/${id}`
      );
      const sale = res.sale;
      setEditingId(id);
      setSoldAt(sale.soldAt);
      setNotes(String(sale.notes || "").replace(/\s*·\s*pay:[a-z0-9_]+/gi, "").trim());
      setPaymentMethod((sale.paymentMethod as PosPaymentMethod) || "cash");
      setOrderDiscount(Math.round(Number(sale.discount) || 0));
      setLines(
        (sale.items || []).map((i) => ({
          key: lineKey(),
          variantId: i.variantId || "",
          productName: i.productName,
          colorName: i.colorName || "",
          size: i.size,
          quantity: i.quantity,
          unitPrice: Math.round(Number(i.unitPrice) || 0),
          discount: Math.round(Number(i.discount) || 0),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open receipt");
    }
  };

  const addLine = () => {
    if (!addVariantId) return;
    const found = catalog.find((v) => v.variantId === addVariantId);
    if (!found) return;
    setLines((prev) => [
      ...prev,
      {
        key: lineKey(),
        variantId: found.variantId,
        productName: found.productName,
        colorName: found.colorName,
        size: addSize,
        quantity: 1,
        unitPrice: Math.round(Number(addPrice || found.price) || 0),
        discount: 0,
      },
    ]);
    setAddVariantId("");
  };

  const save = async () => {
    if (!editingId || lines.length === 0) return;
    setSaving(true);
    setError("");
    setMsg("");
    try {
      await api(`/api/admin/ops/store-sales/${editingId}`, {
        method: "PATCH",
        json: {
          notes,
          paymentMethod,
          discount: orderDisc,
          items: lines.map((l) => ({
            variantId: l.variantId,
            size: l.size,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
          })),
        },
      });
      setMsg("Receipt updated — reception will see the same sale.");
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this receipt and restock the items?")) return;
    setError("");
    setMsg("");
    try {
      await api(`/api/admin/ops/store-sales/${id}`, { method: "DELETE" });
      if (editingId === id) setEditingId(null);
      setMsg("Receipt deleted and stock returned.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const reprint = async (id: string) => {
    try {
      const res = await api<{ sale: ReceiptData }>(`/api/admin/ops/store-sales/${id}`);
      printReceipt(res.sale, loadPaperWidth(), "store");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not print");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black tracking-tight">Store receipts</h2>
        <p className="text-sm text-soul-muted mt-1">
          Edit or void POS sales (size, items, discounts). Reception can reprint only — same
          receipts.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-800">{msg}</p>}

      {editingId && (
        <GlassCard className="p-4 sm:p-5 space-y-4 border border-black/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted">
                Editing receipt
              </p>
              <p className="font-semibold text-sm">
                {soldAt ? new Date(soldAt).toLocaleString() : editingId.slice(0, 8)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="text-xs font-bold tracking-widest uppercase min-h-[40px]"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.key}
                className="rounded-xl border border-black/10 bg-white/60 p-3 grid sm:grid-cols-[1fr_auto] gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {line.productName}
                    <span className="text-soul-muted font-normal"> · {line.colorName}</span>
                  </p>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="text-[10px] font-bold uppercase text-soul-muted">
                      Size
                      <select
                        className={`${field} mt-1`}
                        value={line.size}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key === line.key ? { ...l, size: e.target.value } : l
                            )
                          )
                        }
                      >
                        {ADMIN_SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[10px] font-bold uppercase text-soul-muted">
                      Qty
                      <input
                        type="number"
                        min={1}
                        className={`${field} mt-1`}
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key === line.key
                                ? { ...l, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) }
                                : l
                            )
                          )
                        }
                      />
                    </label>
                    <label className="text-[10px] font-bold uppercase text-soul-muted">
                      Unit (MMK)
                      <input
                        type="number"
                        min={0}
                        className={`${field} mt-1`}
                        value={line.unitPrice}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key === line.key
                                ? {
                                    ...l,
                                    unitPrice: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  }
                                : l
                            )
                          )
                        }
                      />
                    </label>
                    <label className="text-[10px] font-bold uppercase text-soul-muted">
                      Line disc.
                      <input
                        type="number"
                        min={0}
                        className={`${field} mt-1`}
                        value={line.discount}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key === line.key
                                ? {
                                    ...l,
                                    discount: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  }
                                : l
                            )
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  className="text-[10px] font-bold tracking-widest uppercase text-red-700 self-start min-h-[40px]"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <GlassCard className="p-3 bg-white/50 space-y-3">
            <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted">
              Add item
            </p>
            <VariantStockPicker
              variants={pickerVariants}
              variantId={addVariantId}
              size={addSize}
              onVariantChange={(id, _sizes, price) => {
                setAddVariantId(id);
                if (price != null) setAddPrice(Math.round(Number(price) || 0));
              }}
              onSizeChange={setAddSize}
            />
            <button
              type="button"
              onClick={addLine}
              disabled={!addVariantId}
              className="text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full glass min-h-[44px] disabled:opacity-40"
            >
              Add to receipt
            </button>
          </GlassCard>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-[10px] font-bold uppercase text-soul-muted">
              Payment
              <select
                className={`${field} mt-1`}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PosPaymentMethod)}
              >
                {POS_PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-soul-muted">
              Order discount (MMK)
              <input
                type="number"
                min={0}
                className={`${field} mt-1`}
                value={orderDiscount}
                onChange={(e) => setOrderDiscount(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-soul-muted sm:col-span-1">
              Notes
              <input
                className={`${field} mt-1`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-black/10">
            <p className="text-sm">
              Due <span className="font-black text-xl tabular-nums">{formatMMK(due)}</span>
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || lines.length === 0}
              className="btn-soul--dark rounded-full px-6 min-h-[48px] text-xs disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save receipt"}
            </button>
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-4 sm:p-5 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-soul-muted py-4">Loading…</p>
        ) : (
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-soul-muted uppercase tracking-wider">
                <th className="py-2">When</th>
                <th>Items</th>
                <th>Total</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-black/5">
                  <td className="py-2.5">{new Date(s.soldAt).toLocaleString()}</td>
                  <td>{s.unitCount ?? "—"}</td>
                  <td className="font-semibold">{formatMMK(s.total)}</td>
                  <td className="text-right space-x-1">
                    <button
                      type="button"
                      onClick={() => void openEdit(s.id)}
                      className="text-[10px] font-bold tracking-widest uppercase px-3 py-2 rounded-full glass min-h-[40px]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void reprint(s.id)}
                      className="text-[10px] font-bold tracking-widest uppercase px-3 py-2 rounded-full glass min-h-[40px]"
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(s.id)}
                      className="text-[10px] font-bold tracking-widest uppercase px-3 py-2 rounded-full text-red-700 min-h-[40px]"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && sales.length === 0 && (
          <p className="text-sm text-soul-muted py-4">No store receipts yet.</p>
        )}
      </GlassCard>
    </div>
  );
}
