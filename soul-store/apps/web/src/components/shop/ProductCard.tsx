import Link from "next/link";
import Image from "next/image";
import { ProductListItem } from "@/lib/api";
import { PriceDisplay } from "@/components/shop/PriceDisplay";

type Props = { product: ProductListItem; showNewBadge?: boolean };

export function ProductCard({ product, showNewBadge }: Props) {
  const isNew = showNewBadge ?? product.tags?.includes("new");
  const isSale = product.onSale ?? product.tags?.includes("sale");
  const img = product.imageUrl || "/assets/hero-image.png";

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <article className="card-soul">
        <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
          <Image
            src={img}
            alt={product.name}
            fill
            quality={75}
            loading="lazy"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width:768px) 50vw, 25vw"
          />
          {isSale && (
            <span className="absolute top-3 left-3 px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full bg-red-600 text-white">
              {product.discountPercent ? `-${product.discountPercent}%` : "Sale"}
            </span>
          )}
          {isNew && (
            <span
              className={`absolute left-3 glass px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full ${
                isSale ? "top-12" : "top-3"
              }`}
            >
              New
            </span>
          )}
        </div>
        <div className="p-3 sm:p-5">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-soul-muted mb-1 truncate">{product.categoryId}</p>
          <h3 className="font-semibold text-xs sm:text-base line-clamp-2 group-hover:opacity-70 transition-opacity">{product.name}</h3>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <PriceDisplay
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              onSale={product.onSale}
              discountPercent={product.discountPercent}
              size="sm"
            />
            <span className="flex items-center gap-1.5 text-[10px] sm:text-xs text-soul-muted truncate">
              <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: product.colorHex }} />
              {product.colorName}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
