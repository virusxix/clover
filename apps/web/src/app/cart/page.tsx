"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { PriceDisplay } from "@/components/shop/PriceDisplay";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";

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
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);

  const load = () => {
    api<{ items: CartItem[]; subtotal: number }>("/api/cart")
      .then((d) => { setItems(d.items); setSubtotal(d.subtotal); })
      .catch(() => { setItems([]); setSubtotal(0); });
  };

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    else if (user) load();
  }, [user, authLoading, router]);

  const remove = async (id: string) => {
    await api(`/api/cart/${id}`, { method: "DELETE" });
    load();
  };

  if (authLoading || !user) return null;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-16">
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-6 sm:mb-8">Your Bag</h1>

      {items.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <p className="text-soul-muted mb-4">Your bag is empty.</p>
          <Link href="/shop" className="btn-soul--dark rounded-full inline-flex">
            Continue Shopping
          </Link>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <GlassCard key={item.id} className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
              <div className="flex gap-4 items-center flex-1 min-w-0">
                <div className="relative w-20 h-24 rounded-xl overflow-hidden shrink-0">
                  <CatalogImage src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="80px" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/product/${item.slug}`} className="font-semibold hover:opacity-70 line-clamp-2">{item.name}</Link>
                  <p className="text-sm text-soul-muted mt-0.5">
                    {item.colorName} · Size {item.size} · Qty {item.quantity}
                  </p>
                  <PriceDisplay
                    price={item.price}
                    compareAtPrice={item.compareAtPrice}
                    onSale={item.onSale}
                    size="sm"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 shrink-0 border-t sm:border-t-0 border-black/5 pt-3 sm:pt-0">
                <div className="text-right">
                  <p className="font-bold text-lg sm:text-base text-soul-sale">{formatMMK(item.lineTotal)}</p>
                  {item.onSale && item.compareAtPrice != null && (
                    <p className="text-xs text-soul-muted line-through">
                      {formatMMK(item.compareAtPrice * item.quantity)}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => remove(item.id)} className="text-xs text-soul-muted hover:text-black min-h-[44px] px-2">
                  Remove
                </button>
              </div>
            </GlassCard>
          ))}

          <GlassCard className="p-5 sm:p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-soul-muted">Subtotal</p>
              <p className="text-2xl font-black">{formatMMK(subtotal)}</p>
            </div>
            <Link href="/checkout" className="btn-soul--dark rounded-full w-full sm:w-auto text-center min-h-[48px] flex items-center justify-center">
              Checkout
            </Link>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
