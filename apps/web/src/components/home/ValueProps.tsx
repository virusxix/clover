import { GlassCard } from "@/components/ui/GlassCard";

const ITEMS = [
  {
    icon: "🚚",
    title: "Free Shipping Over 150,000 Ks",
    sub: "On all orders in Myanmar",
    link: "Shop Now",
  },
  {
    icon: "📦",
    title: "Easy Returns",
    sub: "30-day hassle-free returns",
    link: "Read More",
  },
  {
    icon: "🛡",
    title: "Secure Checkout",
    sub: "KBZPay · Card · COD (MDY)",
    link: "Learn More",
  },
  {
    icon: "🏷",
    title: "Student Discount",
    sub: "use code: STUDENT30",
    link: "Apply Code",
  },
];

export function ValueProps() {
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 pb-12 sm:pb-20">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {ITEMS.map((item) => (
          <GlassCard
            key={item.title}
            className="p-4 sm:p-6 text-center hover:shadow-card-hover transition-shadow duration-300"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 rounded-full bg-neutral-100 flex items-center justify-center text-lg sm:text-xl">
              {item.icon}
            </div>
            <h3 className="font-bold text-xs sm:text-sm mb-1 leading-snug">{item.title}</h3>
            <p className="text-[11px] sm:text-xs text-soul-muted mb-2 sm:mb-3 leading-snug">{item.sub}</p>
            <button
              type="button"
              className="text-[10px] font-bold tracking-widest uppercase underline underline-offset-4 hover:opacity-60 min-h-[36px]"
            >
              {item.link}
            </button>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
