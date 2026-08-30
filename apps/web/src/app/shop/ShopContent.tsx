"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductGridSkeleton } from "@/components/shop/ProductGridSkeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, ProductListItem } from "@/lib/api";

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "jackets", label: "Jackets" },
  { id: "long-sleeve", label: "Long Sleeve" },
  { id: "short-sleeve", label: "Short Sleeve" },
  { id: "hoodies", label: "Hoodies" },
  { id: "shorts", label: "Shorts" },
  { id: "skirts", label: "Skirts" },
  { id: "leggings", label: "Leggings" },
  { id: "tops", label: "Tops & Bras" },
];

const SIZES = ["XS", "S", "M", "L", "XL"];

function FilterPanel({
  category,
  setCategory,
  size,
  setSize,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
}: {
  category: string;
  setCategory: (v: string) => void;
  size: string;
  setSize: (v: string) => void;
  minPrice: string;
  setMinPrice: (v: string) => void;
  maxPrice: string;
  setMaxPrice: (v: string) => void;
}) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <p className="text-xs font-bold tracking-widest uppercase mb-3">Category</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id || "all"}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`px-3 py-2 text-xs rounded-full border transition-all min-h-[36px] ${
                category === c.id ? "bg-black text-white border-black" : "border-black/10 hover:border-black/30"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold tracking-widest uppercase mb-3">Size</p>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(size === s ? "" : s)}
              className={`min-w-[2.5rem] h-10 text-xs rounded-full border transition-all ${
                size === s ? "bg-black text-white border-black" : "border-black/10 hover:border-black/30"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold tracking-widest uppercase mb-3">Price</p>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full min-w-0 px-3 py-2.5 text-sm rounded-xl border border-black/10 bg-white/50"
          />
          <input
            type="number"
                placeholder="Max (Ks)"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full min-w-0 px-3 py-2.5 text-sm rounded-xl border border-black/10 bg-white/50"
          />
        </div>
      </div>
    </div>
  );
}

type Props = {
  initialProducts?: ProductListItem[];
  initialQuery?: string;
};

function buildClientQuery(
  category: string,
  size: string,
  minPrice: string,
  maxPrice: string,
  params: URLSearchParams,
  isSale: boolean
) {
  const q = new URLSearchParams();
  q.set("limit", "12");
  q.set("gender", "women");
  if (category) q.set("category", category);
  if (size) q.set("size", size);
  if (minPrice) q.set("minPrice", minPrice);
  if (maxPrice) q.set("maxPrice", maxPrice);
  if (params.get("featured") === "true") q.set("featured", "true");
  if (isSale) q.set("sale", "true");
  return q.toString();
}

export function ShopContent({ initialProducts = [], initialQuery = "" }: Props) {
  const params = useSearchParams();
  const [products, setProducts] = useState<ProductListItem[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(params.get("category") || "");
  const [size, setSize] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isSale = params.get("sale") === "true";

  useEffect(() => {
    setCategory(params.get("category") || "");
  }, [params]);

  useEffect(() => {
    const q = buildClientQuery(category, size, minPrice, maxPrice, params, isSale);
    if (q === initialQuery && initialProducts.length > 0) {
      setProducts(initialProducts);
      return;
    }

    setLoading(true);
    api<{ products: ProductListItem[] }>(`/api/products?${q}`)
      .then((d) => setProducts(d.products))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [category, size, minPrice, maxPrice, params, isSale, initialQuery, initialProducts]);

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

  const activeFilters = [category, size, minPrice, maxPrice].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-16 sm:pb-20">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          {isSale ? "Sale" : "Shop"}
        </h1>
        <p className="text-soul-muted text-sm mt-2 max-w-xl">
          Women&apos;s sportswear — designed for training, yoga, and everyday movement.
        </p>
      </div>

      {/* Mobile filter toggle */}
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl glass text-sm font-semibold min-h-[48px]"
          aria-expanded={filtersOpen}
        >
          <span>Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}</span>
          <span className="text-soul-muted">{filtersOpen ? "▲" : "▼"}</span>
        </button>
        {filtersOpen && (
          <GlassCard className="p-4 sm:p-5 mt-2">
            <FilterPanel {...filterProps} />
          </GlassCard>
        )}
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,260px)_1fr] gap-6 lg:gap-8">
        <GlassCard className="hidden lg:block p-5 h-fit space-y-6 sticky top-28">
          <FilterPanel {...filterProps} />
        </GlassCard>

        <div className="min-w-0">
          {loading ? (
            <ProductGridSkeleton count={6} />
          ) : products.length === 0 ? (
            <GlassCard className="p-8 sm:p-12 text-center text-soul-muted">No products match your filters.</GlassCard>
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
