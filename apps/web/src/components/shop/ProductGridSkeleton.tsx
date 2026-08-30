export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 md:gap-6" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-soul overflow-hidden animate-pulse">
          <div className="aspect-[3/4] bg-neutral-200/80" />
          <div className="p-4 sm:p-5 space-y-2">
            <div className="h-2 w-1/3 bg-neutral-200 rounded" />
            <div className="h-4 w-4/5 bg-neutral-200 rounded" />
            <div className="h-3 w-1/2 bg-neutral-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
