import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";

/**
 * CatalogError
 * ------------
 * One job: show a friendly message when product APIs fail
 * (instead of pretending the catalog is empty).
 */

export function CatalogError({
  title = "Catalog unavailable",
  message = "We couldn’t load products. The store database may still be waking up or not seeded yet.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <GlassCard className="p-8 sm:p-12 text-center">
      <h2 className="text-lg font-bold tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-soul-muted mb-6 max-w-md mx-auto">{message}</p>
      <Link href="/shop" className="btn-soul--dark rounded-full inline-flex min-h-[44px] px-6">
        Try again
      </Link>
    </GlassCard>
  );
}
