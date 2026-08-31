"use client";

/**
 * Admin inventory
 * ---------------
 * View stock by location; adjust qty; transfer website ↔ store.
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
  cost: number;
};

export function AdminInventoryTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [catalog, setCatalog] = useState<CatalogVariant[]>([]);
  const [location, setLocation] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [adjustVariant, setAdjustVariant] = useState("");
  const [adjustSize, setAdjustSize] = useState("M");
  const [transferVariant, setTransferVariant] = useState("");
  const [transferSize, setTransferSize] = useState("M");

  const catalogOptions = useMemo(() => variantsFromCatalog(catalog), [catalog]);
  const transferOptions = useMemo(() => variantsFromStock(items), [items]);

  const load = () => {
    const params = new URLSearchParams();
    if (location) params.set("location", location);
    if (q) params.set("q", q);
    Promise.all([
      api<{ items: Item[] }>(`/api/admin/ops/inventory?${params}`),
      api<{ variants: CatalogVariant[] }>("/api/admin/ops/variants"),
    ])
      .then(([inv, cats]) => {
        setItems(inv.items);
        setCatalog(cats.variants);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold text-soul-muted">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={load}
            onKeyDown={(e) => e.key === "Enter" && load()}
            className={`${field} mt-1`}
            placeholder="Name or product code (e.g. SO1pljk)"
          />
        </div>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={field}
        >
          <option value="">All locations</option>
          <option value="website">Website</option>
          <option value="store">Store</option>
          <option value="iconic">ICONIC</option>
        </select>
        <button type="button" onClick={load} className="btn-soul--dark rounded-full min-h-[44px] px-5">
          Refresh
        </button>
      </div>

      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <GlassCard className="p-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs text-soul-muted uppercase tracking-wider">
              <th className="py-2">Product</th>
              <th>Color</th>
              <th>Size</th>
              <th>Location</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={`${i.variantId}-${i.locationId}-${i.size}`} className="border-t border-black/5">
                <td className="py-2 font-medium">
                  <span className="block">{i.productName}</span>
                  {i.productCode && (
                    <span className="text-[10px] text-soul-muted font-mono">{i.productCode}</span>
                  )}
                </td>
                <td>{i.colorName}</td>
                <td>{i.size}</td>
                <td className="capitalize">{i.locationId}</td>
                <td>{i.qty}</td>
                <td>{formatMMK(i.price)}</td>
                <td>{formatMMK(i.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="text-sm text-soul-muted py-6 text-center">
            No stock rows yet. Use Adjust stock below to receive inventory into a location.
          </p>
        )}
      </GlassCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <p className="text-xs font-bold tracking-widest uppercase mb-3">Adjust stock</p>
          <p className="text-[11px] text-soul-muted mb-3">
            Use +qty to receive stock, −qty to correct. Works even if the location starts at zero.
          </p>
          <form onSubmit={onAdjust} className="space-y-3 text-sm">
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
            <select name="locationId" required className={field} defaultValue="store">
              <option value="website">Website</option>
              <option value="store">Store</option>
              <option value="iconic">ICONIC</option>
            </select>
            <input name="delta" required type="number" placeholder="Delta (+10 / -2)" className={field} />
            <input name="notes" placeholder="Notes" className={field} />
            <button
              type="submit"
              disabled={saving || !adjustVariant}
              className="btn-soul--dark rounded-full w-full min-h-[44px] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Apply"}
            </button>
          </form>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-xs font-bold tracking-widest uppercase mb-3">Transfer website ↔ store</p>
          <form onSubmit={onTransfer} className="space-y-3 text-sm">
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
            <input name="qty" required type="number" min={1} placeholder="Qty" className={field} />
            <select name="fromLocation" className={field} defaultValue="store">
              <option value="store">From store</option>
              <option value="website">From website</option>
            </select>
            <select name="toLocation" className={field} defaultValue="website">
              <option value="website">To website</option>
              <option value="store">To store</option>
            </select>
            <button
              type="submit"
              disabled={saving || !transferVariant}
              className="btn-soul--dark rounded-full w-full min-h-[44px] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Transfer"}
            </button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
