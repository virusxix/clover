"use client";

/**
 * Admin inventory
 * ---------------
 * Browse stock grouped by product; search/filter; adjust & transfer.
 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  VariantStockPicker,
  variantsFromCatalog,
  variantsFromStock,
  type CatalogVariant,
  type StockRow,
} from "@/components/admin/VariantStockPicker";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";

const field =
  "w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm min-h-[44px] bg-white/70";

type Item = StockRow & {
  locationId: string;
  price: number;
  cost?: number;
  productId?: string;
};

type ProductGroup = {
  key: string;
  productName: string;
  productCode?: string | null;
  totalQty: number;
  locations: string[];
  rows: Item[];
};

function groupItems(items: Item[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const i of items) {
    const key = i.productId || i.productCode || i.productName;
    const existing = map.get(key);
    if (existing) {
      existing.totalQty += i.qty;
      existing.rows.push(i);
      if (!existing.locations.includes(i.locationId)) {
        existing.locations.push(i.locationId);
      }
    } else {
      map.set(key, {
        key,
        productName: i.productName,
        productCode: i.productCode,
        totalQty: i.qty,
        locations: [i.locationId],
        rows: [i],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.productName.localeCompare(b.productName)
  );
}

export function AdminInventoryTab({ hideCosts = false }: { hideCosts?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [catalog, setCatalog] = useState<CatalogVariant[]>([]);
  const [location, setLocation] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showActions, setShowActions] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [adjustVariant, setAdjustVariant] = useState("");
  const [adjustSize, setAdjustSize] = useState("M");
  const [transferVariant, setTransferVariant] = useState("");
  const [transferSize, setTransferSize] = useState("M");

  const catalogOptions = useMemo(() => variantsFromCatalog(catalog), [catalog]);
  const transferOptions = useMemo(() => variantsFromStock(items), [items]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = () => {
    const params = new URLSearchParams();
    if (location) params.set("location", location);
    if (debouncedQ) params.set("q", debouncedQ);
    setLoading(true);
    Promise.all([
      api<{ items: Item[] }>(`/api/admin/ops/inventory?${params}`),
      api<{ variants: CatalogVariant[] }>("/api/admin/ops/variants"),
    ])
      .then(([inv, cats]) => {
        setItems(inv.items);
        setCatalog(cats.variants);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, debouncedQ]);

  const filteredItems = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (lowOnly && !(i.qty > 0 && i.qty <= 3)) return false;
      if (!needle) return true;
      const code = (i.productCode || "").toLowerCase();
      const name = (i.productName || "").toLowerCase();
      // Match full/partial product code or name (e.g. s01pljk, SO1)
      return code.includes(needle) || name.includes(needle);
    });
  }, [items, lowOnly, q]);

  const groups = useMemo(() => groupItems(filteredItems), [filteredItems]);

  // Auto-expand when search narrows to a few products
  useEffect(() => {
    if (!q.trim() || groups.length === 0 || groups.length > 5) return;
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.key] = true;
    setExpanded(next);
  }, [q, groups]);

  const totals = useMemo(() => {
    const units = filteredItems.reduce((s, i) => s + i.qty, 0);
    return { products: groups.length, rows: filteredItems.length, units };
  }, [filteredItems, groups.length]);

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.key] = true;
    setExpanded(next);
  };

  const collapseAll = () => setExpanded({});

  const onAdjust = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!adjustVariant) {
      setError("Select a product");
      return;
    }
    setMsg("");
    setError("");
    setSaving(true);
    const fd = new FormData(form);
    try {
      await api("/api/admin/ops/inventory/adjust", {
        method: "POST",
        json: {
          variantId: adjustVariant,
          locationId: fd.get("locationId"),
          size: adjustSize,
          delta: Number(fd.get("delta")),
          notes: fd.get("notes") || undefined,
        },
      });
      setMsg("Stock updated");
      form.reset();
      setAdjustVariant("");
      setAdjustSize("M");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjust failed");
    } finally {
      setSaving(false);
    }
  };

  const onTransfer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!transferVariant) {
      setError("Select a product");
      return;
    }
    setMsg("");
    setError("");
    setSaving(true);
    const fd = new FormData(form);
    try {
      await api("/api/admin/ops/inventory/transfer", {
        method: "POST",
        json: {
          variantId: transferVariant,
          size: transferSize,
          qty: Number(fd.get("qty")),
          fromLocation: fd.get("fromLocation"),
          toLocation: fd.get("toLocation"),
        },
      });
      setMsg("Transfer done");
      form.reset();
      setTransferVariant("");
      setTransferSize("M");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <GlassCard className="p-4 space-y-3 sticky top-2 z-10 bg-white/95 backdrop-blur-md">
        <div className="space-y-1.5">
          <label htmlFor="inventory-search" className="block text-xs font-semibold text-soul-muted">
            Find by name or product code
          </label>
          <input
            id="inventory-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${field} block`}
            placeholder="e.g. s01pljk or Ribbed Zip"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={`${field} sm:max-w-xs sm:w-56 shrink-0`}
            aria-label="Location"
          >
            <option value="">All locations</option>
            <option value="website">Website</option>
            <option value="store">Store</option>
            <option value="iconic">ICONIC</option>
          </select>
          <button
            type="button"
            onClick={load}
            className="btn-soul--dark rounded-full min-h-[44px] px-5 shrink-0 sm:ml-auto"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
              className="rounded border-black/20"
            />
            Low stock only (≤3)
          </label>
          <span className="text-soul-muted">
            {loading
              ? "Loading…"
              : `${totals.products} products · ${totals.rows} lines · ${totals.units} units`}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 rounded-full border border-black/10 hover:bg-black/5"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 rounded-full border border-black/10 hover:bg-black/5"
            >
              Collapse
            </button>
          </div>
        </div>
      </GlassCard>

      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {groups.map((g) => {
          const open = !!expanded[g.key];
          return (
            <GlassCard key={g.key} className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(g.key)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-black/[0.02] min-h-[52px]"
              >
                <span
                  className={`text-soul-muted text-xs transition-transform ${open ? "rotate-90" : ""}`}
                  aria-hidden
                >
                  ▸
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{g.productName}</p>
                  <p className="text-[11px] text-soul-muted flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                    {g.productCode && (
                      <span className="font-mono font-semibold text-soul-ink">{g.productCode}</span>
                    )}
                    <span>{g.rows.length} stock line{g.rows.length === 1 ? "" : "s"}</span>
                    <span className="capitalize">{g.locations.join(" · ")}</span>
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums shrink-0">{g.totalQty}</span>
              </button>

              {open && (
                <div className="border-t border-black/5 overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="text-left text-[10px] text-soul-muted uppercase tracking-wider">
                        <th className="px-4 py-2">Color</th>
                        <th className="py-2">Size</th>
                        <th className="py-2">Location</th>
                        <th className="py-2">Qty</th>
                        <th className="py-2">Price</th>
                        {!hideCosts && <th className="px-4 py-2">Cost</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((i) => (
                        <tr
                          key={`${i.variantId}-${i.locationId}-${i.size}`}
                          className="border-t border-black/5"
                        >
                          <td className="px-4 py-2">{i.colorName}</td>
                          <td className="py-2">{i.size}</td>
                          <td className="py-2 capitalize">{i.locationId}</td>
                          <td
                            className={`py-2 font-medium tabular-nums ${
                              i.qty <= 3 ? "text-amber-700" : ""
                            }`}
                          >
                            {i.qty}
                          </td>
                          <td className="py-2">{formatMMK(i.price)}</td>
                          {!hideCosts && (
                            <td className="px-4 py-2">{formatMMK(i.cost ?? 0)}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          );
        })}

        {!loading && groups.length === 0 && (
          <GlassCard className="p-6">
            <p className="text-sm text-soul-muted text-center">
              {q || lowOnly || location
                ? "No products match these filters."
                : "No stock rows yet. Open Receive / transfer below to add inventory."}
            </p>
          </GlassCard>
        )}
      </div>

      <GlassCard className="overflow-hidden">
        <button
          type="button"
          onClick={() => setShowActions((v) => !v)}
          className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-black/[0.02] min-h-[48px]"
        >
          <span className="text-xs font-bold tracking-widest uppercase">
            Receive / transfer stock
          </span>
          <span className={`text-soul-muted text-xs transition-transform ${showActions ? "rotate-90" : ""}`}>
            ▸
          </span>
        </button>

        {showActions && (
          <div className="border-t border-black/5 p-4 grid lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
            {/* Adjust */}
            <form onSubmit={onAdjust} className="flex flex-col gap-3 text-sm h-full">
              <div className="min-h-[3.25rem]">
                <p className="text-xs font-bold tracking-widest uppercase">Adjust stock</p>
                <p className="text-[11px] text-soul-muted mt-1">
                  +qty to receive, −qty to correct. Works from zero.
                </p>
              </div>

              <VariantStockPicker
                variants={catalogOptions}
                variantId={adjustVariant}
                size={adjustSize}
                onVariantChange={(id, sizes) => {
                  setAdjustVariant(id);
                  if (sizes.length) setAdjustSize(sizes[0]);
                }}
                onSizeChange={setAdjustSize}
              />

              <div>
                <label className="block text-[11px] font-semibold text-soul-muted mb-1">
                  Location
                </label>
                <select name="locationId" required className={field} defaultValue="store">
                  <option value="website">Website</option>
                  <option value="store">Store</option>
                  <option value="iconic">ICONIC</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-soul-muted mb-1">
                  Quantity change
                </label>
                <input
                  name="delta"
                  required
                  type="number"
                  placeholder="Delta (+10 / -2)"
                  className={field}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-soul-muted mb-1">Notes</label>
                <input name="notes" placeholder="Optional notes" className={field} />
              </div>

              <button
                type="submit"
                disabled={saving || !adjustVariant}
                className="btn-soul--dark rounded-full w-full min-h-[44px] disabled:opacity-50 mt-auto"
              >
                {saving ? "Saving…" : "Apply"}
              </button>
            </form>

            {/* Transfer */}
            <form onSubmit={onTransfer} className="flex flex-col gap-3 text-sm h-full">
              <div className="min-h-[3.25rem]">
                <p className="text-xs font-bold tracking-widest uppercase">
                  Transfer website ↔ store
                </p>
                <p className="text-[11px] text-soul-muted mt-1">
                  Move existing stock between website and store.
                </p>
              </div>

              <VariantStockPicker
                variants={transferOptions}
                variantId={transferVariant}
                size={transferSize}
                emptyLabel="Select product with stock…"
                onVariantChange={(id, sizes) => {
                  setTransferVariant(id);
                  if (sizes.length) setTransferSize(sizes[0]);
                }}
                onSizeChange={setTransferSize}
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-soul-muted mb-1">From</label>
                  <select name="fromLocation" className={field} defaultValue="store">
                    <option value="store">Store</option>
                    <option value="website">Website</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-soul-muted mb-1">To</label>
                  <select name="toLocation" className={field} defaultValue="website">
                    <option value="website">Website</option>
                    <option value="store">Store</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-soul-muted mb-1">
                  Quantity
                </label>
                <input
                  name="qty"
                  required
                  type="number"
                  min={1}
                  placeholder="Qty to move"
                  className={field}
                />
              </div>

              <button
                type="submit"
                disabled={saving || !transferVariant}
                className="btn-soul--dark rounded-full w-full min-h-[44px] disabled:opacity-50 mt-auto"
              >
                {saving ? "Saving…" : "Transfer"}
              </button>
            </form>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
