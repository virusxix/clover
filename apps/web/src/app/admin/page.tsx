"use client";

/**
 * Admin shell
 * -----------
 * Tab router for dashboard, ops (analytics/inventory/store/iconic), catalog, orders, users.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminProductsTab, AdminProduct } from "@/components/admin/AdminProductsTab";
import { AdminSaleSettings } from "@/components/admin/AdminSaleSettings";
import { AdminAnalyticsTab } from "@/components/admin/AdminAnalyticsTab";
import { AdminInventoryTab } from "@/components/admin/AdminInventoryTab";
import { AdminStoreTab } from "@/components/admin/AdminStoreTab";
import { AdminIconicTab } from "@/components/admin/AdminIconicTab";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";

type Tab =
  | "dashboard"
  | "analytics"
  | "inventory"
  | "store"
  | "iconic"
  | "products"
  | "orders"
  | "users";

type Dashboard = {
  totalSales: number;
  activeUsers: number;
  topProducts: { name: string; units: number; revenue: number }[];
  recentOrders: { id: string; status: string; total: number; email: string; createdAt: string }[];
};

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "inventory", label: "Inventory" },
  { id: "store", label: "POS" },
  { id: "iconic", label: "ICONIC" },
  { id: "products", label: "Products" },
  { id: "orders", label: "Orders" },
  { id: "users", label: "Users" },
];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [saleDiscountPercent, setSaleDiscountPercent] = useState(20);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.push("/login");
  }, [user, loading, router]);

  const loadSettings = () => {
    api<{ saleDiscountPercent: number }>("/api/admin/settings")
      .then((s) => setSaleDiscountPercent(s.saleDiscountPercent))
      .catch(() => {});
  };

  const loadProducts = () => {
    api<{ products: AdminProduct[] }>("/api/admin/products")
      .then((d) => setProducts(d.products))
      .catch(() => {});
  };

  useEffect(() => {
    if (user?.role !== "admin") return;
    loadSettings();
    if (tab === "dashboard") {
      api<Dashboard>("/api/admin/dashboard").then(setDash).catch(() => setDash(null));
    }
    if (tab === "products") loadProducts();
    if (tab === "orders") {
      api<{ orders: Record<string, unknown>[] }>("/api/admin/orders")
        .then((d) => setOrders(d.orders))
        .catch(() => setOrders([]));
    }
    if (tab === "users") {
      api<{ users: Record<string, unknown>[] }>("/api/admin/users")
        .then((d) => setUsers(d.users))
        .catch(() => setUsers([]));
    }
  }, [tab, user]);

  const updateStatus = async (orderId: string, status: string) => {
    await api(`/api/admin/orders/${orderId}/status`, { method: "PATCH", json: { status } });
    setTab("orders");
  };

  if (loading || !user || user.role !== "admin") return null;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-16">
      <h1 className="text-xl sm:text-3xl font-black tracking-tight mb-4 sm:mb-6">
        THE CLOVER · Admin
      </h1>

      <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none snap-x snap-mandatory">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 snap-start px-4 py-2.5 sm:py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all min-h-[44px] ${
              tab === t.id ? "bg-black text-white" : "glass hover:shadow-card"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <AdminSaleSettings
            saleDiscountPercent={saleDiscountPercent}
            onUpdated={setSaleDiscountPercent}
          />
          <GlassCard className="p-6">
            <p className="text-xs text-soul-muted uppercase tracking-widest">Website sales</p>
            <p className="text-3xl font-black mt-2">
              {dash ? formatMMK(dash.totalSales) : "—"}
            </p>
          </GlassCard>
          <GlassCard className="p-6">
            <p className="text-xs text-soul-muted uppercase tracking-widest">Customers</p>
            <p className="text-3xl font-black mt-2">{dash?.activeUsers ?? "—"}</p>
          </GlassCard>
          <GlassCard className="p-6 sm:col-span-2">
            <p className="text-xs font-bold tracking-widest uppercase mb-3">Top products</p>
            {(dash?.topProducts || []).map((p) => (
              <div
                key={p.name}
                className="flex flex-col sm:flex-row sm:justify-between gap-0.5 text-sm py-1.5"
              >
                <span className="font-medium truncate">{p.name}</span>
                <span className="text-soul-muted shrink-0">
                  {p.units} sold · {formatMMK(p.revenue)}
                </span>
              </div>
            ))}
            <p className="text-xs text-soul-muted mt-4">
              Open Analytics for channel P&amp;L, ICONIC, and Excel export.
            </p>
          </GlassCard>
        </div>
      )}

      {tab === "analytics" && <AdminAnalyticsTab />}
      {tab === "inventory" && <AdminInventoryTab />}
      {tab === "store" && <AdminStoreTab />}
      {tab === "iconic" && <AdminIconicTab />}

      {tab === "products" && (
        <AdminProductsTab
          products={products}
          onRefresh={loadProducts}
          saleDiscountPercent={saleDiscountPercent}
        />
      )}

      {tab === "orders" && (
        <div className="space-y-3">
          {orders.map((o) => (
            <GlassCard key={String(o.id)} className="p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 mb-3">
                <p className="font-semibold text-sm sm:text-base break-all">
                  #{String(o.id).slice(0, 8)} · {String(o.email)}
                </p>
                <p className="font-bold shrink-0">{formatMMK(Number(o.total_cents))}</p>
              </div>
              <select
                value={String(o.status)}
                onChange={(e) => updateStatus(String(o.id), e.target.value)}
                className="w-full sm:w-auto text-xs px-3 py-2.5 rounded-xl border border-black/10 bg-white/60 min-h-[44px]"
              >
                {["pending", "processing", "shipped", "delivered", "cancelled"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </GlassCard>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-3">
          {users.map((u) => (
            <GlassCard
              key={String(u.id)}
              className="p-4 flex flex-col sm:flex-row sm:justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">{String(u.full_name)}</p>
                <p className="text-sm text-soul-muted break-all">{String(u.email)}</p>
              </div>
              <span className="text-xs font-bold uppercase shrink-0">{String(u.role)}</span>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
