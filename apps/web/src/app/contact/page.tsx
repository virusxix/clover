import { GlassCard } from "@/components/ui/GlassCard";

export default function ContactPage() {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-16">
      <GlassCard className="p-10 text-center">
        <h1 className="text-3xl font-black tracking-tight mb-4">Need Help?</h1>
        <p className="text-soul-muted mb-6">Our team is here for sizing, orders, and returns.</p>
        <p className="font-semibold">support@theclover.com</p>
        <p className="text-sm text-soul-muted mt-2">Mon–Fri · 9am–6pm</p>
      </GlassCard>
    </div>
  );
}
