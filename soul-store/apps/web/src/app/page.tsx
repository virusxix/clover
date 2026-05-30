import { MustHaveGrid } from "@/components/home/MustHaveGrid";
import { ValueProps } from "@/components/home/ValueProps";
import { ProductCard } from "@/components/shop/ProductCard";
import { api, ProductListItem } from "@/lib/api";
import Link from "next/link";

async function getFeatured() {
  try {
    const data = await api<{ products: ProductListItem[] }>("/api/products?featured=true&limit=4");
    return data.products;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const featured = await getFeatured();

  return (
    <>
      <MustHaveGrid />

      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 pb-12 sm:pb-16">
          <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-3xl font-black tracking-tight">Featured</h2>
            <Link href="/shop" className="text-xs font-semibold tracking-widest uppercase hover:opacity-60">
              Shop All →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <ValueProps />
    </>
  );
}
