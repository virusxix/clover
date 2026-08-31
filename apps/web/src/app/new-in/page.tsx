/**
 * New In page
 * -----------
 * One job: show products tagged as new arrivals.
 */

import Link from "next/link";
import { ProductCard } from "@/components/shop/ProductCard";
import { CatalogError } from "@/components/ui/CatalogError";
import { GlassCard } from "@/components/ui/GlassCard";
import { loadCatalog } from "@/lib/catalog";

export default async function NewInPage() {
  const { products, error } = await loadCatalog("new=true&gender=women&limit=12", {
    revalidate: 120,
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-16 sm:pb-20">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-soul-muted mb-2">
          Just dropped
        </p>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight">New In</h1>
        <p className="text-soul-muted text-sm sm:text-base mt-3 max-w-xl">
          The latest arrivals from THE CLOVER — fresh styles added to the collection, not the full
          catalog.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center mt-4 text-xs font-semibold tracking-widest uppercase hover:opacity-60 min-h-[44px]"
        >
          View all shop →
        </Link>
      </header>

      {error ? (
        <CatalogError title="New arrivals unavailable" message={error} />
      ) : products.length === 0 ? (
        <GlassCard className="p-8 sm:p-12 text-center text-soul-muted">
          <p className="mb-4">No new arrivals right now. Check back soon.</p>
          <Link href="/shop" className="btn-soul--dark rounded-full inline-flex min-h-[44px]">
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
