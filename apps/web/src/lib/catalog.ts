/**
 * Catalog loading helpers
 * -----------------------
 * One job: fetch product lists and return either products or a readable error.
 * Pages decide how to render — this never swallows failures as an empty list alone.
 */

import { api, ProductListItem } from "./api";

export type CatalogResult = {
  products: ProductListItem[];
  error: string | null;
};

/** Fetch products for a query string (without leading ?). */
export async function loadCatalog(
  query: string,
  opts?: { revalidate?: number }
): Promise<CatalogResult> {
  try {
    const data = await api<{ products: ProductListItem[] }>(
      `/api/products?${query}`,
      opts?.revalidate != null ? { next: { revalidate: opts.revalidate } } : undefined
    );
    return { products: data.products, error: null };
  } catch (err) {
    return {
      products: [],
      error: err instanceof Error ? err.message : "Failed to load products",
    };
  }
}

/** Build the default shop query (women's catalog, page size 12). */
export function buildShopQuery(input: {
  category?: string;
  size?: string;
  minPrice?: string;
  maxPrice?: string;
  featured?: boolean;
  sale?: boolean;
}) {
  const q = new URLSearchParams();
  q.set("limit", "12");
  q.set("gender", "women");

  if (input.category) q.set("category", input.category);
  if (input.size) q.set("size", input.size);
  if (input.minPrice) q.set("minPrice", input.minPrice);
  if (input.maxPrice) q.set("maxPrice", input.maxPrice);
  if (input.featured) q.set("featured", "true");
  if (input.sale) q.set("sale", "true");

  return q.toString();
}
