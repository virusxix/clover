"use client";

/**
 * THE CLOVER Store POS terminal
 * -----------------------------
 * Browse store stock, build a cart, checkout, print receipt.
 */

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";
import {
  PosReceipt,
  printReceipt,
  downloadReceiptPng,
  buildTestReceipt,
  loadPaperWidth,
  savePaperWidth,
  PAPER_OPTIONS,
  type PaperWidthMm,
  type ReceiptData,
} from "./PosReceipt";

type StockItem = {
  variantId: string;
  productId?: string;
  productName: string;
  productCode?: string | null;
  colorName: string;
  size: string;
  qty: number;
  price: number;
};

type CartLine = {
  key: string;
  variantId: string;
  productName: string;
  productCode?: string | null;
  colorName: string;
  size: string;
  unitPrice: number;
  quantity: number;
  maxQty: number;
};

type SaleRow = {
  id: string;
  soldAt: string;
  total: number;
  notes: string;
  unitCount?: number;
};

type ColorOption = {
  variantId: string;
  colorName: string;
  price: number;
  sizes: { size: string; qty: number }[];
  totalQty: number;
};

/** One style in the grid — colors/sizes chosen step-by-step */
type ProductStyle = {
  productKey: string;
  productName: string;
  productCode?: string | null;
  colors: ColorOption[];
  fromPrice: number;
  totalQty: number;
};

function buildStyles(stock: StockItem[]): ProductStyle[] {
  const byProduct = new Map<
    string,
    {
      productName: string;
      productCode?: string | null;
      colors: Map<string, ColorOption>;
    }
  >();

  for (const row of stock) {
    const productKey = row.productId || `${row.productCode || ""}::${row.productName}`;
    let product = byProduct.get(productKey);
    if (!product) {
      product = {
        productName: row.productName,
        productCode: row.productCode,
        colors: new Map(),
      };
      byProduct.set(productKey, product);
    }

    let color = product.colors.get(row.variantId);
    if (!color) {
      color = {
        variantId: row.variantId,
        colorName: row.colorName,
        price: row.price,
        sizes: [],
        totalQty: 0,
      };
      product.colors.set(row.variantId, color);
    }
    color.sizes.push({ size: row.size, qty: row.qty });
    color.totalQty += row.qty;
  }

  return [...byProduct.entries()]
    .map(([productKey, p]) => {
      const colors = [...p.colors.values()].sort((a, b) => a.colorName.localeCompare(b.colorName));
      return {
        productKey,
        productName: p.productName,
        productCode: p.productCode,
        colors,
        fromPrice: Math.min(...colors.map((c) => c.price)),
        totalQty: colors.reduce((s, c) => s + c.totalQty, 0),
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

type PickerState = {
  style: ProductStyle;
  /** null = choosing color; set = choosing size for that color */
  color: ColorOption | null;
};

export function PosTerminal() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer" | "other">("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [paperMm, setPaperMm] = useState<PaperWidthMm>(56);

  useEffect(() => {
    setPaperMm(loadPaperWidth());
  }, []);

  const styles = useMemo(() => buildStyles(stock), [stock]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return styles;
    return styles.filter(
      (p) =>
        p.productName.toLowerCase().includes(needle) ||
        (p.productCode || "").toLowerCase().includes(needle) ||
        p.colors.some((c) => c.colorName.toLowerCase().includes(needle))
    );
  }, [styles, q]);

  const cartTotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const cartUnits = cart.reduce((s, l) => s + l.quantity, 0);

  const load = () => {
    Promise.all([
      api<{ items: StockItem[] }>("/api/admin/ops/inventory?location=store"),
      api<{ sales: SaleRow[] }>("/api/admin/ops/store-sales"),
    ])
      .then(([inv, s]) => {
        setStock(inv.items);
        setSales(s.sales);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load POS"));
  };

  useEffect(() => {
    load();
  }, []);

  const openProduct = (style: ProductStyle) => {
    // Single color → skip straight to size
    if (style.colors.length === 1) {
      setPicker({ style, color: style.colors[0] });
    } else {
      setPicker({ style, color: null });
    }
    setError("");
  };

  const addToCart = (color: ColorOption, size: string, style: ProductStyle) => {
    const sizeRow = color.sizes.find((s) => s.size === size);
    if (!sizeRow || sizeRow.qty < 1) {
      setError(`No store stock for ${style.productName} / ${color.colorName} / ${size}`);
      return;
    }
    const key = `${color.variantId}:${size}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        if (existing.quantity >= sizeRow.qty) {
          setError(`Only ${sizeRow.qty} left in store for that size`);
          return prev;
        }
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          key,
          variantId: color.variantId,
          productName: style.productName,
          productCode: style.productCode,
          colorName: color.colorName,
          size,
          unitPrice: color.price,
          quantity: 1,
          maxQty: sizeRow.qty,
        },
      ];
    });
    setError("");
    setPicker(null);
  };

  const setQty = (key: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l;
          const q = Math.max(0, Math.min(l.maxQty, quantity));
          return { ...l, quantity: q };
        })
        .filter((l) => l.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setNotes("");
    setPaymentMethod("cash");
  };

  const checkout = async () => {
    if (!cart.length) {
      setError("Cart is empty");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api<ReceiptData>("/api/admin/ops/store-sales", {
        method: "POST",
        json: {
          paymentMethod,
          notes: notes.trim() || undefined,
          items: cart.map((l) => ({
            variantId: l.variantId,
            size: l.size,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      });
      setReceipt(res);
      clearCart();
      load();
      // Phone + PeriPage: save/share PNG (browser print won't reach A40)
      void downloadReceiptPng(res, paperMm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setSaving(false);
    }
  };

  const reprint = async (saleId: string) => {
    setError("");
    try {
      const res = await api<{ sale: ReceiptData }>(`/api/admin/ops/store-sales/${saleId}`);
      setReceipt(res.sale);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load receipt");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight">Store POS</h2>
          <p className="text-sm text-soul-muted mt-1 max-w-xl">
            Sell from store stock · save receipt PNG → print from PeriPage app on your phone
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={paperMm}
            onChange={(e) => {
              const mm = Number(e.target.value) as PaperWidthMm;
              setPaperMm(mm);
              savePaperWidth(mm);
            }}
            className="px-3 py-2 rounded-full border border-black/10 bg-white/70 text-[10px] font-bold tracking-widest uppercase min-h-[44px]"
            aria-label="Receipt paper width"
          >
            {PAPER_OPTIONS.map((o) => (
              <option key={o.mm} value={o.mm}>
                Paper {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={async () => {
              const test = buildTestReceipt();
              setReceipt(test);
              await downloadReceiptPng(test, paperMm);
            }}
            className="btn-soul--dark rounded-full min-h-[44px] px-5 text-[10px]"
          >
            Test PNG for phone
          </button>
          <button
            type="button"
            onClick={load}
            className="btn-soul--glass rounded-full min-h-[44px] px-5 text-[10px]"
          >
            Refresh stock
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          {error}
        </p>
      )}

      <GlassCard className="p-4 text-sm text-soul-muted leading-relaxed">
        <p className="text-xs font-bold tracking-widest uppercase text-soul-ink mb-2">
          Print with phone + PeriPage A40
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            On the phone: install <strong>PeriPage</strong>, turn on the A40, connect Bluetooth{" "}
            <em>inside the app</em> (not only in phone Settings).
          </li>
          <li>Set paper clips on the A40 to match the width dropdown (try <strong>56mm</strong>).</li>
          <li>
            On this POS (or open the site on your phone): tap <strong>Test PNG for phone</strong> —
            save/share the image.
          </li>
          <li>
            In PeriPage app → print from gallery / image → pick the receipt PNG → Print.
          </li>
        </ol>
      </GlassCard>

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-4 lg:gap-6">
        {/* Catalog */}
        <GlassCard className="p-4 sm:p-5 min-h-[420px]">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
            <p className="text-xs font-bold tracking-widest uppercase shrink-0">Products</p>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or code (SO1pljk)"
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 bg-white/70 text-sm min-h-[44px]"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-soul-muted py-10 text-center">
              No store stock. Receive inventory into Store first.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 max-h-[min(70vh,640px)] overflow-y-auto pr-1">
              {filtered.map((p) => (
                <button
                  key={p.productKey}
                  type="button"
                  onClick={() => openProduct(p)}
                  className="text-left rounded-2xl bg-white/70 border border-black/5 p-4 hover:shadow-card transition-shadow min-h-[96px]"
                >
                  {p.productCode && (
                    <span className="font-mono text-[10px] text-soul-muted">{p.productCode}</span>
                  )}
                  <p className="font-semibold leading-snug mt-0.5">{p.productName}</p>
                  <p className="text-xs text-soul-muted mt-1">
                    {p.colors.length} color{p.colors.length === 1 ? "" : "s"} · {p.totalQty} in store
                  </p>
                  <p className="text-sm font-bold mt-2">
                    {p.colors.length > 1 && p.colors.some((c) => c.price !== p.fromPrice)
                      ? `from ${formatMMK(p.fromPrice)}`
                      : formatMMK(p.fromPrice)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Cart */}
        <GlassCard className="p-4 sm:p-5 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold tracking-widest uppercase">Cart</p>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-[10px] font-bold tracking-widest uppercase text-soul-muted hover:text-black"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-[min(50vh,420px)]">
            {cart.length === 0 && (
              <p className="text-sm text-soul-muted py-8 text-center">
                Tap a product to add it
              </p>
            )}
            {cart.map((line) => (
              <div
                key={line.key}
                className="rounded-xl bg-white/60 border border-black/5 p-3 flex gap-3 items-start"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm leading-snug">{line.productName}</p>
                  <p className="text-[11px] text-soul-muted">
                    {[line.productCode, line.colorName, `Sz ${line.size}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs mt-1">{formatMMK(line.unitPrice)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="w-9 h-9 rounded-full glass text-lg leading-none"
                    onClick={() => setQty(line.key, line.quantity - 1)}
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold text-sm">{line.quantity}</span>
                  <button
                    type="button"
                    className="w-9 h-9 rounded-full glass text-lg leading-none"
                    onClick={() => setQty(line.key, line.quantity + 1)}
                    aria-label="Increase"
                    disabled={line.quantity >= line.maxQty}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-black/10 pt-4 mt-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {(["cash", "card", "transfer", "other"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`px-3 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase min-h-[40px] ${
                    paymentMethod === m ? "bg-black text-white" : "glass"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note (optional)"
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 bg-white/70 text-sm min-h-[44px]"
            />
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-soul-muted uppercase tracking-wider">
                {cartUnits} item{cartUnits === 1 ? "" : "s"}
              </span>
              <span className="text-2xl font-black tracking-tight">{formatMMK(cartTotal)}</span>
            </div>
            <button
              type="button"
              onClick={checkout}
              disabled={saving || cart.length === 0}
              className="btn-soul--dark rounded-full w-full min-h-[52px] text-xs disabled:opacity-50"
            >
              {saving ? "Processing…" : "Charge & print ready"}
            </button>
          </div>
        </GlassCard>
      </div>

      {/* Recent sales */}
      <GlassCard className="p-4 sm:p-5 overflow-x-auto">
        <p className="text-xs font-bold tracking-widest uppercase mb-3">Recent sales</p>
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-left text-xs text-soul-muted uppercase tracking-wider">
              <th className="py-2">When</th>
              <th>Items</th>
              <th>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-black/5">
                <td className="py-2.5">{new Date(s.soldAt).toLocaleString()}</td>
                <td>{s.unitCount ?? "—"}</td>
                <td className="font-semibold">{formatMMK(s.total)}</td>
                <td className="text-right">
                  <button
                    type="button"
                    onClick={() => reprint(s.id)}
                    className="text-[10px] font-bold tracking-widest uppercase px-3 py-2 rounded-full glass min-h-[40px]"
                  >
                    Receipt
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sales.length === 0 && (
          <p className="text-sm text-soul-muted py-4">No store sales yet.</p>
        )}
      </GlassCard>

      {/* Step picker: color → size */}
      {picker && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3"
          role="dialog"
          aria-modal="true"
          onClick={() => setPicker(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--soul-bg)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-soul-muted mb-2">
              <span className={!picker.color ? "text-black" : ""}>1 · Color</span>
              <span aria-hidden>→</span>
              <span className={picker.color ? "text-black" : ""}>2 · Size</span>
            </div>
            <p className="font-black text-lg tracking-tight">{picker.style.productName}</p>
            <p className="text-sm text-soul-muted">
              {picker.style.productCode || ""}
              {picker.color ? ` · ${picker.color.colorName}` : ""}
            </p>

            {!picker.color ? (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {picker.style.colors.map((c) => (
                  <button
                    key={c.variantId}
                    type="button"
                    disabled={c.totalQty < 1}
                    onClick={() => setPicker({ ...picker, color: c })}
                    className="text-left rounded-xl border border-black/10 bg-white/80 p-3 disabled:opacity-30 min-h-[72px]"
                  >
                    <p className="font-semibold text-sm">{c.colorName}</p>
                    <p className="text-[11px] text-soul-muted mt-0.5">{c.totalQty} left</p>
                    <p className="text-xs font-bold mt-1">{formatMMK(c.price)}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
                {picker.color.sizes.map((s) => (
                  <button
                    key={s.size}
                    type="button"
                    disabled={s.qty < 1}
                    onClick={() => addToCart(picker.color!, s.size, picker.style)}
                    className="rounded-xl border border-black/10 bg-white/80 py-3 text-sm font-semibold disabled:opacity-30 min-h-[52px]"
                  >
                    {s.size}
                    <span className="block text-[10px] text-soul-muted font-normal">{s.qty} left</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              {picker.color && picker.style.colors.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPicker({ ...picker, color: null })}
                  className="flex-1 text-xs font-bold tracking-widest uppercase py-3 rounded-full glass min-h-[44px]"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => setPicker(null)}
                className="flex-1 text-xs font-bold tracking-widest uppercase py-3 rounded-full glass min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {receipt && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <PosReceipt receipt={receipt} />
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <button
                type="button"
                onClick={() => void downloadReceiptPng(receipt, paperMm)}
                className="btn-soul--dark rounded-full flex-1 min-h-[48px]"
              >
                Save / share PNG
              </button>
              <button
                type="button"
                onClick={() => printReceipt(receipt, paperMm)}
                className="btn-soul--glass rounded-full flex-1 min-h-[48px]"
              >
                Browser print
              </button>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="btn-soul--glass rounded-full flex-1 min-h-[48px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
