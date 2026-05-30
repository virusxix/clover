import Link from "next/link";
import { ProductCard } from "@/components/shop/ProductCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, ProductListItem } from "@/lib/api";

async function getNewArrivals() {
  try {
    const data = await api<{ products: ProductListItem[] }>(
      "/api/products?new=true&gender=women&limit=48"
    );
    return data.products;
  } catch {
    return [];
  }
}

export default async function NewInPage() {
  const products = await getNewArrivals();

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-16 sm:pb-20">
      <div className="mb-10">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-soul-muted mb-2">Just dropped</p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">New In</h1>
        <p className="text-soul-muted text-sm sm:text-base mt-3 max-w-xl">
          The latest arrivals from THE CLOVER — fresh styles added to the collection, not the full catalog.
        </p>
        <Link href="/shop" className="inline-block mt-4 text-xs font-semibold tracking-widest uppercase hover:opacity-60">
          View all shop →
        </Link>
      </div>

      {products.length === 0 ? (
        <GlassCard className="p-12 text-center text-soul-muted">
          <p className="mb-4">No new arrivals right now. Check back soon.</p>
          <Link href="/shop" className="btn-soul--dark rounded-full inline-flex">
            Browse shop
          </Link>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
          {products.map((p) => (
            <ProductCard key={`${p.id}-${p.variantId}`} product={p} showNewBadge />
          ))}
        </div>
      )}
    </div>
  );
}
