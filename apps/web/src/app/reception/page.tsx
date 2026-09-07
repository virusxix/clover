"use client";

/**
 * Reception / floor console
 * -------------------------
 * Store-worker workspace: POS, inventory, ICONIC, website orders.
 * No owner analytics, users, profit, or catalog admin.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminInventoryTab } from "@/components/admin/AdminInventoryTab";
import { AdminStoreTab } from "@/components/admin/AdminStoreTab";
import { AdminIconicTab } from "@/components/admin/AdminIconicTab";
import { AdminOrdersTab, type AdminOrder } from "@/components/admin/AdminOrdersTab";
import { AdminCustomersTab } from "@/components/admin/AdminCustomersTab";
import { ReceptionOrderAlerts } from "@/components/admin/ReceptionOrderAlerts";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";
import { isAdmin, isReception } from "@/lib/roles";

type Tab = "home" | "pos" | "inventory" | "iconic" | "orders" | "customers";

type FloorSummary = {
  pendingOrders: number;
  today: { sales: number; units: number; total: number };
  lowStockStore: number;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Floor" },
  { id: "pos", label: "POS" },
  { id: "orders", label: "Orders" },
  { id: "customers", label: "Customers" },
  { id: "inventory", label: "Inventory" },
  { id: "iconic", label: "ICONIC" },
];

function canUseFloor(role?: string | null) {
  return isReception(role) || isAdmin(role);
}

export default function ReceptionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [summary, setSummary] = useState<FloorSummary | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/reception/login");
      return;
    }
    if (canUseFloor(user.role)) return;
    router.replace("/account");
  }, [user, loading, router]);

  const loadOrders = () => {
    api<{ orders: AdminOrder[] }>("/api/admin/orders")
      .then((d) => setOrders(d.orders || []))
      .catch(() => setOrders([]));
  };

  const loadPendingCount = () => {
    api<{ count: number }>("/api/admin/orders/pending-count")
      .then((d) => setPendingOrderCount(Math.max(0, Number(d.count) || 0)))
      .catch(() => {});
  };

  const loadSummary = () => {
    api<FloorSummary>("/api/admin/floor/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
  };

  useEffect(() => {
    if (!user || !canUseFloor(user.role)) return;
    loadPendingCount();
    loadSummary();
    const id = window.setInterval(() => {
      loadPendingCount();
      if (tab === "home") loadSummary();
    }, 10000);
    return () => window.clearInterval(id);
  }, [user, tab]);

  useEffect(() => {
    if (!user || !canUseFloor(user.role)) return;
    if (tab === "orders") loadOrders();
    if (tab === "home") loadSummary();
  }, [tab, user]);

  useEffect(() => {
    if (!user || !canUseFloor(user.role) || tab !== "orders") return;
    const id = window.setInterval(loadOrders, 10000);
    return () => window.clearInterval(id);
  }, [tab, user]);

  const updateStatus = async (orderId: string, status: string) => {
    await api(`/api/admin/orders/${orderId}/status`, { method: "PATCH", json: { status } });
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    loadPendingCount();
    loadSummary();
  };

  const updatePayment = async (orderId: string, received: boolean) => {
    const res = await api<{
      order: {
        id: string;
        status: string;
        paymentReceived: boolean;
        paymentReceivedAt: string | null;
      };
    }>(`/api/admin/orders/${orderId}/payment`, {
      method: "PATCH",
      json: { received },
    });
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: res.order.status || o.status,
              payment_received: res.order.paymentReceived,
              payment_received_at: res.order.paymentReceivedAt,
            }
          : o
      )
    );
    loadPendingCount();
    loadSummary();
  };

  if (loading || !user || !canUseFloor(user.role)) return null;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted mb-1">
            Store floor
          </p>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight">
            THE CLOVER · Reception
          </h1>
          <p className="text-sm text-soul-muted mt-1">
            POS · website orders · stock · ICONIC — no owner financials
          </p>
        </div>
      </div>

      <ReceptionOrderAlerts />

      <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none snap-x snap-mandatory">
        {TABS.map((tabItem) => {
          const showBadge = tabItem.id === "orders" && pendingOrderCount > 0;
          const active = tab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={`shrink-0 snap-start inline-flex items-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all min-h-[44px] ${
                active ? "bg-black text-white" : "glass hover:shadow-card"
              }`}
              aria-label={
                showBadge ? `Orders, ${pendingOrderCount} pending` : tabItem.label
              }
            >
              {tabItem.label}
              {showBadge && (
                <span
                  className={`min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-black tabular-nums inline-flex items-center justify-center ${
                    active ? "bg-white text-black" : "bg-red-600 text-white"
                  }`}
                >
                  {pendingOrderCount > 99 ? "99+" : pendingOrderCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "home" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted">
                Web orders waiting
              </p>
              <p className="text-3xl font-black mt-2 tabular-nums">
                {summary?.pendingOrders ?? pendingOrderCount ?? "—"}
              </p>
              <button
                type="button"
                onClick={() => setTab("orders")}
                className="mt-3 text-[10px] font-bold tracking-widest uppercase underline underline-offset-4"
              >
                Open orders
              </button>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted">
                Today · store sales
              </p>
              <p className="text-3xl font-black mt-2 tabular-nums">
                {summary ? summary.today.sales : "—"}
              </p>
              <p className="text-sm text-soul-muted mt-1">
                {summary
                  ? `${summary.today.units} units · ${formatMMK(summary.today.total)}`
                  : "Loading…"}
              </p>
              <button
                type="button"
                onClick={() => setTab("pos")}
                className="mt-3 text-[10px] font-bold tracking-widest uppercase underline underline-offset-4"
              >
                Open POS
              </button>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted">
                Low store stock
              </p>
              <p className="text-3xl font-black mt-2 tabular-nums">
                {summary?.lowStockStore ?? "—"}
              </p>
              <p className="text-sm text-soul-muted mt-1">Sizes with 1–3 left in store</p>
              <button
                type="button"
                onClick={() => setTab("inventory")}
                className="mt-3 text-[10px] font-bold tracking-widest uppercase underline underline-offset-4"
              >
                Check inventory
              </button>
            </GlassCard>
          </div>

          <GlassCard className="p-5 sm:p-6">
            <p className="text-xs font-bold tracking-widest uppercase mb-3">Quick actions</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { id: "pos" as Tab, title: "New walk-in sale", body: "Charge, discount, print receipt" },
                { id: "orders" as Tab, title: "Pack website order", body: "Print slip · pack · mark paid when cash lands" },
                { id: "customers" as Tab, title: "Customers", body: "New / regular / loyal / VIP tags" },
                { id: "inventory" as Tab, title: "Stock count / move", body: "Adjust store · transfer locations" },
                { id: "iconic" as Tab, title: "ICONIC handoff", body: "Send stock or enter monthly sold" },
              ].map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setTab(a.id)}
                  className="text-left rounded-xl border border-black/10 bg-white/60 px-4 py-3.5 min-h-[72px] hover:bg-white transition-colors"
                >
                  <p className="font-semibold text-sm">{a.title}</p>
                  <p className="text-xs text-soul-muted mt-0.5">{a.body}</p>
                </button>
              ))}
            </div>
          </GlassCard>

          <p className="text-xs text-soul-muted px-1">
            Signed in as {user.fullName} · role {user.role}. Costs, profit, users, and analytics stay in
            Owner Admin only.
          </p>
        </div>
      )}

      {tab === "pos" && <AdminStoreTab />}
      {tab === "inventory" && <AdminInventoryTab hideCosts />}
      {tab === "iconic" && <AdminIconicTab />}
      {tab === "orders" && (
        <AdminOrdersTab
          orders={orders}
          onStatusChange={updateStatus}
          onPaymentChange={updatePayment}
          onOrdersRefresh={loadOrders}
        />
      )}
      {tab === "customers" && <AdminCustomersTab />}
    </div>
  );
}
