"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatMMK } from "@/lib/currency";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type WishItem = {
  product_id: string;
  slug: string;
  name: string;
  price_cents: number;
  color_name: string;
  image_url?: string;
};

export default function WishlistPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<WishItem[]>([]);

  const load = () => api<{ items: WishItem[] }>("/api/wishlist").then((d) => setItems(d.items));

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    else if (user) load();
  }, [user, loading, router]);

  const remove = async (productId: string) => {
    await api(`/api/wishlist/${productId}`, { method: "DELETE" });
    load();
  };

  if (loading || !user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black tracking-tight">Wishlist</h1>
        <Link href="/account" className="text-xs tracking-widest uppercase hover:opacity-60">← Account</Link>
      </div>

      {items.length === 0 ? (
        <GlassCard className="p-12 text-center text-soul-muted">Your wishlist is empty.</GlassCard>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <GlassCard key={item.product_id} className="p-4 flex gap-4 items-center">
              <div className="relative w-16 h-20 rounded-xl overflow-hidden">
                <CatalogImage src={item.image_url} alt={item.name} fill className="object-cover" sizes="64px" />
              </div>
              <div className="flex-1">
                <Link href={`/product/${item.slug}`} className="font-semibold hover:opacity-70">{item.name}</Link>
                <p className="text-sm text-soul-muted">{item.color_name}</p>
              </div>
              <p className="font-bold">{formatMMK(item.price_cents || 0)}</p>
              <button type="button" onClick={() => remove(item.product_id)} className="text-xs text-soul-muted hover:text-black">Remove</button>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
