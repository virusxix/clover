import { Suspense } from "react";
import { ShopContent } from "./ShopContent";
import { api, ProductListItem } from "@/lib/api";

type SearchParams = Record<string, string | string[] | undefined>;

function buildShopQuery(searchParams: SearchParams) {
  const q = new URLSearchParams();
  q.set("limit", "12");
  q.set("gender", "women");
  const category = searchParams.category;
  if (typeof category === "string" && category) q.set("category", category);
  if (searchParams.featured === "true") q.set("featured", "true");
  if (searchParams.sale === "true") q.set("sale", "true");
  return q.toString();
}

async function loadProducts(query: string) {
  try {
    const data = await api<{ products: ProductListItem[] }>(`/api/products?${query}`, {
      next: { revalidate: 120 },
    });
    return data.products;
  } catch {
    return [];
  }
}

export default async function ShopPage({
  searchParams = {},
}: {
  searchParams?: SearchParams;
}) {
  const initialQuery = buildShopQuery(searchParams);
  const initialProducts = await loadProducts(initialQuery);

  return (
    <Suspense fallback={<div className="p-10 text-center text-soul-muted">Loading shop…</div>}>
      <ShopContent initialProducts={initialProducts} initialQuery={initialQuery} />
    </Suspense>
  );
}
