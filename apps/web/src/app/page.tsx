/**
 * Home page
 * ---------
 * One job: compose marketing sections + featured products.
 * Catalog fetch is shared via lib/catalog.
 */

import { MustHaveGrid } from "@/components/home/MustHaveGrid";
import { ValueProps } from "@/components/home/ValueProps";
import { ProductCard } from "@/components/shop/ProductCard";
import { CatalogError } from "@/components/ui/CatalogError";
import { loadCatalog } from "@/lib/catalog";
import Link from "next/link";

export default async function HomePage() {
  const { products: featured, error } = await loadCatalog("featured=true&limit=4", {
    revalidate: 120,
  });

  return (
    <>
      <MustHaveGrid />

      <section className="max-w-7xl mx-auto px-3 sm:px-6 pb-12 sm:pb-16">
        <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-3xl font-black tracking-tight">Featured</h2>
          <Link
            href="/shop"
            className="text-xs font-semibold tracking-widest uppercase hover:opacity-60 shrink-0 min-h-[44px] inline-flex items-center"
          >
            Shop All →
          </Link>
        </div>

        {error ? (
          <CatalogError title="Featured unavailable" message={error} />
        ) : featured.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-soul-muted">No featured products yet.</p>
        )}
      </section>

      <ValueProps />
    </>
  );
}
