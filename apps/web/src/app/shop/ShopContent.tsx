"use client";

/**
 * Shop catalog UI
 * ---------------
 * One job: keep filter state, refetch products, render the grid.
 * Filters UI → ShopFilterPanel. Fetch helpers → lib/catalog.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductGridSkeleton } from "@/components/shop/ProductGridSkeleton";
import { ShopFilterPanel } from "@/components/shop/ShopFilterPanel";
import { CatalogError } from "@/components/ui/CatalogError";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProductListItem } from "@/lib/api";
import { buildShopQuery, loadCatalog } from "@/lib/catalog";

type Props = {
  initialProducts?: ProductListItem[];
  initialQuery?: string;
  initialError?: string | null;
};

export function ShopContent({
  initialProducts = [],
  initialQuery = "",
  initialError = null,
}: Props) {
  const params = useSearchParams();
  const isSale = params.get("sale") === "true";

  const [products, setProducts] = useState(initialProducts);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  const [category, setCategory] = useState(params.get("category") || "");
  const [size, setSize] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Keep category chip in sync when the user lands from a category link.
  useEffect(() => {
    setCategory(params.get("category") || "");
  }, [params]);

  // Refetch whenever filters change (skip if SSR already loaded this exact query).
  useEffect(() => {
    const query = buildShopQuery({
      category,
      size,
      minPrice,
      maxPrice,
      featured: params.get("featured") === "true",
      sale: isSale,
    });

    const sameAsSsr =
      query === initialQuery && (initialProducts.length > 0 || Boolean(initialError));

    if (sameAsSsr) {
      setProducts(initialProducts);
      setError(initialError);
      return;
    }

    let cancelled = false;
    setLoading(true);

    loadCatalog(query).then((result) => {
      if (cancelled) return;
      setProducts(result.products);
      setError(result.error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    category,
    size,
    minPrice,
    maxPrice,
    params,
    isSale,
    initialQuery,
    initialProducts,
    initialError,
  ]);

  const filterProps = {
    category,
    setCategory,
    size,
    setSize,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
  };

  const activeFilterCount = [category, size, minPrice, maxPrice].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-16 sm:pb-20">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          {isSale ? "Sale" : "Shop"}
        </h1>
        <p className="text-soul-muted text-sm mt-2 max-w-xl">
          Women&apos;s sportswear — designed for training, yoga, and everyday movement.
        </p>
      </header>

      {/* Mobile: collapsible filters */}
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl glass text-sm font-semibold min-h-[48px] touch-manipulation"
          aria-expanded={filtersOpen}
        >
          <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
          <span className="text-soul-muted">{filtersOpen ? "▲" : "▼"}</span>
        </button>
        {filtersOpen && (
          <GlassCard className="p-4 sm:p-5 mt-2">
            <ShopFilterPanel {...filterProps} />
          </GlassCard>
        )}
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,260px)_1fr] gap-6 lg:gap-8">
        <GlassCard className="hidden lg:block p-5 h-fit sticky top-28">
          <ShopFilterPanel {...filterProps} />
        </GlassCard>

        <div className="min-w-0">
          {loading ? (
            <ProductGridSkeleton count={6} />
          ) : error ? (
            <CatalogError message={error} />
          ) : products.length === 0 ? (
            <GlassCard className="p-8 sm:p-12 text-center text-soul-muted">
              No products match your filters.
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 md:gap-6">
              {products.map((p) => (
                <ProductCard key={`${p.id}-${p.variantId}`} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
