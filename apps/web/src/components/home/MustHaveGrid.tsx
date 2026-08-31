import Link from "next/link";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { assetSrc } from "@/lib/media";

const CATEGORIES = [
  {
    title: "Yoga Essentials",
    desc: "Mats, blocks & studio-ready layers",
    href: "/shop?category=leggings",
    image: assetSrc("/assets/photo_6111774033587147116_y.jpg"),
    badge: "Get 30% Off",
  },
  {
    title: "Training Tops",
    desc: "Bras, tees & long sleeves",
    href: "/shop?category=tops",
    image: assetSrc("/assets/photo_6111774033587147088_y.png"),
  },
  {
    title: "Leggings & Shorts",
    desc: "Compression meets comfort",
    href: "/shop?category=leggings",
    image: assetSrc("/assets/photo_6111774033587147117_y.jpg"),
  },
  {
    title: "Outerwear",
    desc: "Zip jackets & hoodies",
    href: "/shop?category=jackets",
    image: assetSrc("/assets/photo_6111774033587147108_y.jpg"),
  },
];

export function MustHaveGrid() {
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-16">
      <div className="flex items-end justify-between gap-3 mb-5 sm:mb-8">
        <h2 className="text-xl sm:text-3xl font-black tracking-tight">#Must Have</h2>
        <Link
          href="/shop"
          className="text-xs font-semibold tracking-widest uppercase hover:opacity-60 shrink-0 min-h-[44px] inline-flex items-center"
        >
          View All →
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5 md:gap-6">
        {CATEGORIES.map((cat) => (
          <Link key={cat.title} href={cat.href} className="group min-w-0">
            <article className="card-soul relative h-full">
              <div className="relative aspect-[4/5] overflow-hidden">
                <CatalogImage
                  src={cat.image}
                  alt={cat.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width:768px) 50vw, 25vw"
                />
                {cat.badge && (
                  <span className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 glass px-2.5 py-1.5 sm:px-4 sm:py-2 text-[9px] sm:text-[10px] font-bold tracking-widest uppercase rounded-full max-w-[90%] truncate">
                    {cat.badge}
                  </span>
                )}
              </div>
              <div className="p-3 sm:p-5">
                <h3 className="font-bold text-[11px] sm:text-sm uppercase tracking-wide flex items-center gap-1 leading-snug">
                  <span className="line-clamp-2">{cat.title}</span>{" "}
                  <span className="opacity-40 shrink-0">›</span>
                </h3>
                <p className="text-xs sm:text-sm text-soul-muted mt-1 line-clamp-2">
                  {cat.desc}
                </p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
