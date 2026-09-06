"use client";

/**
 * Checkout order summary card
 * ---------------------------
 * One job: show cart lines + totals + (optional) submit button.
 */

import { CatalogImage } from "@/components/ui/CatalogImage";
import { GlassCard } from "@/components/ui/GlassCard";
import { PriceDisplay } from "@/components/shop/PriceDisplay";
import { formatMMK } from "@/lib/currency";

export type CheckoutCartItem = {
  id: string;
  quantity: number;
  size: string;
  name: string;
  colorName: string;
  price: number;
  compareAtPrice?: number | null;
  onSale?: boolean;
  imageUrl?: string;
  lineTotal: number;
};

type Totals = {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  freeShipping: boolean;
  amountUntilFreeShipping: number;
};

type Props = {
  items: CheckoutCartItem[];
  totals: Totals;
  loading: boolean;
  showSubmit?: boolean;
};

export function OrderSummaryCard({ items, totals, loading, showSubmit = false }: Props) {
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <GlassCard className="p-5 sm:p-6 lg:sticky lg:top-28">
      <h2 className="font-bold text-sm tracking-widest uppercase mb-4">
        Order summary <span className="text-soul-muted font-normal">({itemCount})</span>
      </h2>

      <ul className="space-y-4 max-h-[280px] overflow-y-auto pr-1 scrollbar-none mb-5">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <div className="relative w-14 h-[4.5rem] rounded-lg overflow-hidden shrink-0 bg-neutral-100">
              <CatalogImage
                src={item.imageUrl}
                alt={item.name}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-semibold line-clamp-2 leading-snug">{item.name}</p>
              <p className="text-soul-muted text-xs mt-0.5">
                {item.colorName} · {item.size} · Qty {item.quantity}
              </p>
              <div className="mt-1 flex justify-between items-end gap-2">
                <PriceDisplay
                  price={item.price}
                  compareAtPrice={item.compareAtPrice}
                  onSale={item.onSale}
                  size="sm"
                />
                <span className="font-bold shrink-0">{formatMMK(item.lineTotal)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-2 text-sm border-t border-black/5 pt-4">
        <Row label="Subtotal" value={formatMMK(totals.subtotal)} />
        <Row
          label="Shipping"
          value={
            totals.freeShipping ? (
              <span className="text-green-700 font-medium">Free</span>
            ) : (
              formatMMK(totals.shipping)
            )
          }
        />
        {!totals.freeShipping && totals.amountUntilFreeShipping > 0 && (
          <p className="text-[11px] text-soul-muted">
            Add {formatMMK(totals.amountUntilFreeShipping)} more for free shipping
          </p>
        )}
        <Row label="Estimated tax" value={formatMMK(totals.tax)} />
        <div className="flex justify-between pt-2 border-t border-black/5 text-base font-black">
          <span>Total</span>
          <span>{formatMMK(totals.total)}</span>
        </div>
        <p className="text-[10px] text-soul-muted pt-1">MMK · Myanmar delivery</p>
      </div>

      {showSubmit && (
        <button
          type="submit"
          form="checkout-form"
          disabled={loading}
          className="btn-soul--dark w-full rounded-full mt-6 min-h-[52px] hidden lg:flex items-center justify-center"
        >
          {loading ? "Processing…" : `Place order · ${formatMMK(totals.total)}`}
        </button>
      )}
    </GlassCard>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-soul-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
