import { Suspense } from "react";
import { ShopContent } from "./ShopContent";
import { buildShopQuery, loadCatalog } from "@/lib/catalog";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Shop page (server)
 * ------------------
 * One job: read URL search params, load the first product page, hand off to ShopContent.
 */

function queryFromSearchParams(searchParams: SearchParams) {
  const category = typeof searchParams.category === "string" ? searchParams.category : "";
  return buildShopQuery({
    category,
    featured: searchParams.featured === "true",
    sale: searchParams.sale === "true",
  });
}

export default async function ShopPage({
  searchParams = {},
}: {
  searchParams?: SearchParams;
}) {
  const initialQuery = queryFromSearchParams(searchParams);
  const { products, error } = await loadCatalog(initialQuery, { revalidate: 120 });

  return (
    <Suspense fallback={<div className="p-10 text-center text-soul-muted">Loading shop…</div>}>
      <ShopContent
        initialProducts={products}
        initialQuery={initialQuery}
        initialError={error}
      />
    </Suspense>
  );
}
