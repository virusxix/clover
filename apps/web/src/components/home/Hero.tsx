import Link from "next/link";
import Image from "next/image";

const HERO_IMAGE =
  "https://halothemes.net/cdn/shop/files/surfup-soul-pc.jpg?v=1762480592";

export function Hero() {
  return (
    <section className="relative min-h-[calc(70vh+var(--nav-spacer))] lg:min-h-[calc(85vh+var(--nav-spacer))] flex items-center overflow-hidden pt-[var(--nav-spacer)]">
      <Image
        src={HERO_IMAGE}
        alt="THE CLOVER performance sportswear"
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
        <div className="max-w-lg glass-dark rounded-card-lg p-8 sm:p-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] mb-4">
            STRONGER EVERY DAY
          </h1>
          <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-8">
            Premium compression, technical fleece, and training essentials from THE CLOVER —
            engineered for athletes who show up before sunrise.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/shop?category=jackets" className="btn-soul--white text-center rounded-full">
              Shop Clothing
            </Link>
            <Link href="/shop?category=accessories" className="btn-soul--glass text-center rounded-full bg-white/90">
              Shop Accessories
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        <span className="w-2 h-2 rounded-full bg-white" />
        <span className="w-2 h-2 rounded-full bg-white/40" />
      </div>
    </section>
  );
}
