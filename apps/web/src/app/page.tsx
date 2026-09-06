/**
 * Home page
 * ---------
 * One job: compose marketing sections + featured products.
 * Catalog fetch is shared via lib/catalog.
 */

import { MustHaveGrid } from "@/components/home/MustHaveGrid";
import { ValueProps } from "@/components/home/ValueProps";
import { FeaturedSection } from "@/components/home/FeaturedSection";
import { loadCatalog } from "@/lib/catalog";

export default async function HomePage() {
  const { products: featured, error } = await loadCatalog("featured=true&limit=4", {
    revalidate: 120,
  });

  return (
    <>
      <MustHaveGrid />
      <FeaturedSection featured={featured} error={error} />
      <ValueProps />
    </>
  );
}
