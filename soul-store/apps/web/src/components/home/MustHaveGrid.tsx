import Link from "next/link";
import Image from "next/image";

const CATEGORIES = [
  {
    title: "Yoga Essentials",
    desc: "Mats, blocks & studio-ready layers",
    href: "/shop?category=leggings",
    image: "/assets/photo_6111774033587147116_y.jpg",
    badge: "Get 30% Off",
  },
  {
    title: "Training Tops",
    desc: "Bras, tees & long sleeves",
    href: "/shop?category=tops",
    image: "/assets/photo_6111774033587147088_y.png",
  },
  {
    title: "Leggings & Shorts",
    desc: "Compression meets comfort",
    href: "/shop?category=leggings",
    image: "/assets/photo_6111774033587147117_y.jpg",
  },
  {
    title: "Outerwear",
    desc: "Zip jackets & hoodies",
    href: "/shop?category=jackets",
    image: "/assets/photo_6111774033587147108_y.jpg",
  },
];

export function MustHaveGrid() {
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-10 sm:py-16">
      <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-3xl font-black tracking-tight">#Must Have</h2>
        <Link href="/shop" className="text-xs font-semibold tracking-widest uppercase hover:opacity-60">
          View All →
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
        {CATEGORIES.map((cat) => (
          <Link key={cat.title} href={cat.href} className="group">
            <article className="card-soul relative">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width:768px) 50vw, 25vw"
                />
                {cat.badge && (
                  <span className="absolute bottom-4 left-4 glass px-4 py-2 text-[10px] font-bold tracking-widest uppercase rounded-full">
                    {cat.badge}
                  </span>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-1">
                  {cat.title} <span className="opacity-40">›</span>
                </h3>
                <p className="text-sm text-soul-muted mt-1">{cat.desc}</p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
