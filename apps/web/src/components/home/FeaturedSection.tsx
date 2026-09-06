import Link from "next/link";
import { ProductCard } from "@/components/shop/ProductCard";
import { CatalogError } from "@/components/ui/CatalogError";
import { ProductListItem } from "@/lib/api";

type Props = {
  featured: ProductListItem[];
  error: string | null;
};

export function FeaturedSection({ featured, error }: Props) {
  return (
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
  );
}
