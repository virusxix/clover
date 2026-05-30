import { GlassCard } from "@/components/ui/GlassCard";

const ITEMS = [
  { icon: "🚚", title: "Free Shipping Over 150,000 Ks", sub: "On all orders in Myanmar", link: "Shop Now" },
  { icon: "📦", title: "Easy Returns", sub: "30-day hassle-free returns", link: "Read More" },
  { icon: "🛡", title: "Secure Checkout", sub: "256-bit encrypted payments", link: "Learn More" },
  { icon: "🏷", title: "Student Discount", sub: "use code: STUDENT30", link: "Apply Code" },
];

export function ValueProps() {
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 pb-12 sm:pb-20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {ITEMS.map((item) => (
          <GlassCard key={item.title} className="p-6 text-center hover:shadow-card-hover transition-shadow duration-300">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center text-xl">
              {item.icon}
            </div>
            <h3 className="font-bold text-sm mb-1">{item.title}</h3>
            <p className="text-xs text-soul-muted mb-3">{item.sub}</p>
            <button type="button" className="text-[10px] font-bold tracking-widest uppercase underline underline-offset-4 hover:opacity-60">
              {item.link}
            </button>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
