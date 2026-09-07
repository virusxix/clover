"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { PriceDisplay } from "@/components/shop/PriceDisplay";
import { api } from "@/lib/api";
import { formatMMK, FREE_SHIPPING_MIN_MMK, SHIPPING_FEE_MMK } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";

type CartItem = {
  id: string;
  quantity: number;
  size: string;
  slug: string;
  name: string;
  colorName: string;
  price: number;
  compareAtPrice?: number | null;
  onSale?: boolean;
  discountPercent?: number | null;
  imageUrl?: string;
  lineTotal: number;
};

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { refreshCart } = useCart();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const d = await api<{ items: CartItem[]; subtotal: number }>("/api/cart");
      setItems(d.items);
      setSubtotal(d.subtotal);
      await refreshCart();
    } catch {
      setItems([]);
      setSubtotal(0);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    else if (user) void load();
  }, [user, authLoading, router]);

  const remove = async (id: string) => {
    await api(`/api/cart/${id}`, { method: "DELETE" });
    await load();
  };

  const setQty = async (id: string, quantity: number) => {
    if (quantity < 1) {
      await remove(id);
      return;
    }
    if (quantity > 10) return;
    setUpdatingId(id);
    try {
      await api(`/api/cart/${id}`, { method: "PATCH", json: { quantity } });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update quantity");
    } finally {
      setUpdatingId(null);
    }
  };

  if (authLoading || !user) return null;

  const untilFree =
    subtotal >= FREE_SHIPPING_MIN_MMK ? 0 : FREE_SHIPPING_MIN_MMK - subtotal;
  const estShipping = subtotal >= FREE_SHIPPING_MIN_MMK ? 0 : SHIPPING_FEE_MMK;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-12 pb-20">
      <div className="mb-8 sm:mb-10">
        <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted mb-2">
          Shopping bag
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Your Bag</h1>
        {items.length > 0 && (
          <p className="text-sm text-soul-muted mt-2">
            {items.reduce((s, i) => s + i.quantity, 0)} piece
            {items.reduce((s, i) => s + i.quantity, 0) === 1 ? "" : "s"} ready for checkout
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <GlassCard className="p-12 sm:p-16 text-center max-w-lg mx-auto">
          <p className="text-soul-muted mb-6 text-base">Your bag is empty.</p>
          <Link href="/shop" className="btn-soul--dark rounded-full inline-flex min-h-[48px] px-8">
            Continue Shopping
          </Link>
        </GlassCard>
      ) : (
        <div className="grid lg:grid-cols-[1.4fr_0.9fr] gap-8 lg:gap-10 items-start">
          <div className="space-y-5">
            {items.map((item) => (
              <GlassCard key={item.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
                  <Link
                    href={`/product/${item.slug}`}
                    className="relative w-full sm:w-36 h-44 sm:h-44 rounded-2xl overflow-hidden shrink-0 bg-black/5"
                  >
                    <CatalogImage
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="(max-width:640px) 100vw, 144px"
                    />
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col gap-4">
                    <div>
                      <Link
                        href={`/product/${item.slug}`}
                        className="font-semibold text-base sm:text-lg hover:opacity-70 leading-snug"
                      >
                        {item.name}
                      </Link>
                      <p className="text-sm text-soul-muted mt-1.5">
                        {item.colorName} · Size {item.size}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <PriceDisplay
                        price={item.price}
                        compareAtPrice={item.compareAtPrice}
                        onSale={item.onSale}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/80 p-1">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          disabled={updatingId === item.id}
                          onClick={() => void setQty(item.id, item.quantity - 1)}
                          className="w-11 h-11 rounded-full text-lg font-bold touch-manipulation disabled:opacity-40 hover:bg-black/5"
                        >
                          −
                        </button>
                        <span className="min-w-[2.25rem] text-center text-base font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          disabled={updatingId === item.id || item.quantity >= 10}
                          onClick={() => void setQty(item.id, item.quantity + 1)}
                          className="w-11 h-11 rounded-full text-lg font-bold touch-manipulation disabled:opacity-40 hover:bg-black/5"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-3 pt-2 border-t border-black/5 mt-auto">
                      <button
                        type="button"
                        onClick={() => void remove(item.id)}
                        className="text-xs text-soul-muted hover:text-black min-h-[44px] px-1"
                      >
                        Remove
                      </button>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-soul-muted mb-0.5">
                          Line total
                        </p>
                        <p className="font-bold text-lg tabular-nums text-soul-sale">
                          {formatMMK(item.lineTotal)}
                        </p>
                        {item.onSale && item.compareAtPrice != null && (
                          <p className="text-xs text-soul-muted line-through">
                            {formatMMK(item.compareAtPrice * item.quantity)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}

            <Link
              href="/shop"
              className="inline-flex text-sm font-semibold underline underline-offset-4 hover:opacity-70 min-h-[44px] items-center"
            >
              ← Continue shopping
            </Link>
          </div>

          <GlassCard className="p-5 sm:p-7 lg:sticky lg:top-28 space-y-5">
            <p className="text-xs font-bold tracking-widest uppercase">Order summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-soul-muted">Subtotal</span>
                <span className="font-semibold tabular-nums">{formatMMK(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-soul-muted">Shipping (est.)</span>
                <span className="tabular-nums">
                  {estShipping === 0 ? "Free" : formatMMK(estShipping)}
                </span>
              </div>
            </div>
            {untilFree > 0 && (
              <p className="text-xs text-soul-muted rounded-xl bg-black/[0.03] px-3 py-2.5">
                Add {formatMMK(untilFree)} more for free shipping.
              </p>
            )}
            <div className="flex justify-between items-baseline gap-4 pt-3 border-t border-black/10">
              <span className="text-xs uppercase tracking-wider text-soul-muted">Total</span>
              <span className="text-2xl font-black tabular-nums">
                {formatMMK(subtotal + estShipping)}
              </span>
            </div>
            <p className="text-[11px] text-soul-muted">Tax calculated at checkout when applicable.</p>
            <Link
              href="/checkout"
              className="btn-soul--dark rounded-full w-full text-center min-h-[52px] flex items-center justify-center"
            >
              Checkout
            </Link>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
