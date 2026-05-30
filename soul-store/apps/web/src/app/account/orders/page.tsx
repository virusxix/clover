"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Order = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    else if (user) {
      api<{ orders: Order[] }>("/api/orders").then((d) => setOrders(d.orders)).catch(() => setOrders([]));
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black tracking-tight">Order History</h1>
        <Link href="/account" className="text-xs tracking-widest uppercase hover:opacity-60">← Account</Link>
      </div>

      {orders.length === 0 ? (
        <GlassCard className="p-12 text-center text-soul-muted">No orders yet.</GlassCard>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <GlassCard key={o.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Order #{o.id.slice(0, 8)}</p>
                <p className="text-sm text-soul-muted">{new Date(o.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_COLORS[o.status] || ""}`}>
                {o.status}
              </span>
              <p className="font-bold">{formatMMK(o.total)}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
