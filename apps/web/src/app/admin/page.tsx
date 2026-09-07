"use client";

/**
 * Admin shell
 * -----------
 * Owner console: overview, analytics, catalog, receipts, users.
 * Floor POS stays on Reception; admin can edit/void shared store receipts.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminProductsTab, AdminProduct } from "@/components/admin/AdminProductsTab";
import { AdminSaleSettings } from "@/components/admin/AdminSaleSettings";
import { AdminAnalyticsTab } from "@/components/admin/AdminAnalyticsTab";
import { AdminUsersTab, type AdminUser } from "@/components/admin/AdminUsersTab";
import { AdminReceiptsTab } from "@/components/admin/AdminReceiptsTab";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";
import { isAdmin, isReception } from "@/lib/roles";

type Tab = "dashboard" | "analytics" | "products" | "receipts" | "users";

type Dashboard = {
  totalSales: number;
  activeUsers: number;
  topProducts: { name: string; units: number; revenue: number }[];
  recentOrders: { id: string; status: string; total: number; email: string; createdAt: string }[];
};

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "products", label: "Products" },
  { id: "receipts", label: "Receipts" },
  { id: "users", label: "Users" },
];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [saleDiscountPercent, setSaleDiscountPercent] = useState(20);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/admin/login");
      return;
    }
    if (isReception(user.role)) {
      router.replace("/reception");
      return;
    }
    if (!isAdmin(user.role)) {
      router.push("/login");
    }
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

  const loadUsers = () => {
    api<{ users: AdminUser[] }>("/api/admin/users")
      .then((d) => setUsers(d.users || []))
      .catch(() => setUsers([]));
  };

  useEffect(() => {
    if (!isAdmin(user?.role)) return;
    loadSettings();
    if (tab === "dashboard") {
      api<Dashboard>("/api/admin/dashboard").then(setDash).catch(() => setDash(null));
    }
    if (tab === "products") loadProducts();
    if (tab === "users") loadUsers();
  }, [tab, user]);

  const updateUserRole = async (userId: string, role: string, confirmPassword?: string) => {
    const res = await api<{ user: AdminUser }>(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      json: { role, ...(confirmPassword ? { confirmPassword } : {}) },
    });
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: res.user?.role || role } : u))
    );
  };

  if (loading || !user || !isAdmin(user.role)) return null;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted mb-1">
            Owner console
          </p>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight">THE CLOVER · Admin</h1>
          <p className="text-sm text-soul-muted mt-1">
            Profit, catalog, users, analytics — POS and floor ops use the reception account
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none snap-x snap-mandatory">
        {TABS.map((tabItem) => {
          const active = tab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={`shrink-0 snap-start inline-flex items-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all min-h-[44px] ${
                active ? "bg-black text-white" : "glass hover:shadow-card"
              }`}
            >
              {tabItem.label}
            </button>
          );
        })}
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

      {tab === "products" && (
        <AdminProductsTab
          products={products}
          onRefresh={loadProducts}
          saleDiscountPercent={saleDiscountPercent}
        />
      )}

      {tab === "receipts" && <AdminReceiptsTab />}

      {tab === "users" && <AdminUsersTab users={users} onRoleChange={updateUserRole} />}
    </div>
  );
}
