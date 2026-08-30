import { formatPrice } from "@/lib/pricing";

type Props = {
  price: number;
  compareAtPrice?: number | null;
  onSale?: boolean;
  discountPercent?: number | null;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: { sale: "text-sm font-bold", original: "text-xs", badge: "text-[9px] px-1.5 py-0.5" },
  md: { sale: "text-sm sm:text-base font-bold", original: "text-xs sm:text-sm", badge: "text-[10px] px-2 py-0.5" },
  lg: { sale: "text-2xl font-bold", original: "text-lg", badge: "text-xs px-2.5 py-1" },
};

export function PriceDisplay({
  price,
  compareAtPrice,
  onSale,
  discountPercent,
  size = "md",
  showBadge = false,
  className = "",
}: Props) {
  const s = sizeClasses[size];
  const hasDiscount = onSale && compareAtPrice != null && compareAtPrice > price;

  if (!hasDiscount) {
    return <span className={`font-bold ${s.sale} ${className}`}>{formatPrice(price)}</span>;
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span className={`${s.sale} text-soul-sale`}>{formatPrice(price)}</span>
      <span className={`${s.original} text-soul-muted line-through`}>{formatPrice(compareAtPrice)}</span>
      {showBadge && discountPercent != null && (
        <span className={`${s.badge} font-bold tracking-wider uppercase rounded-full bg-red-600 text-white`}>
          -{discountPercent}%
        </span>
      )}
    </div>
  );
}
