"use client";

/**
 * Admin / floor orders
 * -------------------
 * Pack & ship for real-world delivery. Print anytime.
 * Mark paid only when cash / KBZ / transfer actually lands.
 */

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatMMK } from "@/lib/currency";
import { PAYMENT_LABELS } from "@/lib/payments";
import { loadPaperWidth, printReceipt, type ReceiptData } from "@/components/admin/pos/PosReceipt";
import { api } from "@/lib/api";

const PAGE_SIZE = 12;
const STATUSES = [
  "awaiting_payment",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type AdminOrder = {
  id: string;
  email?: string;
  full_name?: string;
  status: string;
  total_cents: number;
  created_at?: string;
  shipping_name?: string;
  shipping_phone?: string | null;
  shipping_city?: string;
  shipping_state?: string;
  payment_method?: string | null;
  payment_received?: boolean;
  payment_received_at?: string | null;
};

type Props = {
  orders: AdminOrder[];
  onStatusChange: (orderId: string, status: string) => Promise<void>;
  onPaymentChange?: (orderId: string, received: boolean) => Promise<void>;
  onOrdersRefresh?: () => void;
};

function dedupeOrders(orders: AdminOrder[]) {
  const map = new Map<string, AdminOrder>();
  for (const o of orders) {
    if (!o?.id || map.has(o.id)) continue;
    map.set(o.id, o);
  }
  return Array.from(map.values());
}

function isPaid(o: AdminOrder) {
  return Boolean(o.payment_received || o.payment_received_at);
}

function formatDate(raw?: string) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminOrdersTab({
  orders,
  onStatusChange,
  onPaymentChange,
  onOrdersRefresh,
}: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("pending");
  const [payFilter, setPayFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [page, setPage] = useState(1);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = dedupeOrders(orders).sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return tb - ta;
    });
    const needle = q.trim().toLowerCase();
    return list.filter((o) => {
      if (status && o.status !== status) return false;
      if (payFilter === "paid" && !isPaid(o)) return false;
      if (payFilter === "unpaid" && isPaid(o)) return false;
      if (!needle) return true;
      const hay = `${o.id} ${o.email || ""} ${o.full_name || ""} ${o.shipping_name || ""} ${
        o.payment_method || ""
      }`.toLowerCase();
      return hay.includes(needle);
    });
  }, [orders, q, status, payFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { unpaid: 0 };
    for (const s of STATUSES) c[s] = 0;
    for (const o of dedupeOrders(orders)) {
      c[o.status] = (c[o.status] || 0) + 1;
      if (!isPaid(o) && o.status !== "cancelled") c.unpaid += 1;
    }
    return c;
  }, [orders]);

  const changeStatus = async (id: string, next: string) => {
    setSavingId(id);
    try {
      await onStatusChange(id, next);
    } finally {
      setSavingId(null);
    }
  };

  const changePayment = async (id: string, received: boolean) => {
    if (!onPaymentChange) return;
    setSavingId(id);
    try {
      await onPaymentChange(id, received);
    } finally {
      setSavingId(null);
    }
  };

  const printOrder = async (id: string) => {
    setPrintId(id);
    try {
      const receipt = await api<ReceiptData>(`/api/admin/orders/${id}/receipt`);
      printReceipt(receipt, loadPaperWidth(), "website");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not print receipt");
    } finally {
      setPrintId(null);
    }
  };

  const saveCustomer = async (id: string) => {
    setSavingId(id);
    try {
      await api(`/api/admin/orders/${id}/save-customer`, { method: "POST", json: {} });
      onOrdersRefresh?.();
      alert("Customer saved to CRM");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save customer");
    } finally {
      setSavingId(null);
    }
  };

  const field =
    "w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm min-h-[44px] bg-white/70";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-tight">
            Orders
            <span className="text-soul-muted font-semibold text-sm ml-2">{filtered.length}</span>
          </h2>
          <p className="text-xs text-soul-muted mt-1 max-w-2xl">
            Print packing slips anytime. Pack and ship for delivery.{" "}
            <strong>Mark paid</strong> only after real money arrives (COD cash, KBZ, etc.) —
            printing does not mark paid.
          </p>
        </div>
      </div>

      <GlassCard className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search email, name, payment, or order id…"
            className={`${field} flex-1`}
            autoComplete="off"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={`${field} sm:w-44`}
            aria-label="Status filter"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s} ({counts[s] || 0})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPayFilter("all");
              setPage(1);
            }}
            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
              payFilter === "all" ? "bg-black text-white border-black" : "border-black/10 text-soul-muted"
            }`}
          >
            Money: all
          </button>
          <button
            type="button"
            onClick={() => {
              setPayFilter("unpaid");
              setPage(1);
            }}
            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
              payFilter === "unpaid"
                ? "bg-amber-700 text-white border-amber-700"
                : "border-black/10 text-soul-muted"
            }`}
          >
            Unpaid ({counts.unpaid || 0})
          </button>
          <button
            type="button"
            onClick={() => {
              setPayFilter("paid");
              setPage(1);
            }}
            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
              payFilter === "paid"
                ? "bg-emerald-800 text-white border-emerald-800"
                : "border-black/10 text-soul-muted"
            }`}
          >
            Paid
          </button>
          <span className="w-px bg-black/10 mx-1 hidden sm:inline-block" aria-hidden />
          <button
            type="button"
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
              !status ? "bg-black text-white border-black" : "border-black/10 text-soul-muted"
            }`}
          >
            All status
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border capitalize ${
                status === s ? "bg-black text-white border-black" : "border-black/10 text-soul-muted"
              }`}
            >
              {s} ({counts[s] || 0})
            </button>
          ))}
        </div>
      </GlassCard>

      <div className="space-y-3">
        {pageItems.map((o) => {
          const pay = PAYMENT_LABELS[o.payment_method || ""] || o.payment_method || "—";
          const place = [o.shipping_city, o.shipping_state].filter(Boolean).join(", ");
          const paid = isPaid(o);
          return (
            <GlassCard key={o.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {o.shipping_name || o.full_name || o.email || "Customer"}
                    </p>
                    <p className="text-xs text-soul-muted mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span className="font-mono">#{o.id.slice(0, 8)}</span>
                      {o.email && <span className="break-all">{o.email}</span>}
                      {o.shipping_phone && <span>{o.shipping_phone}</span>}
                      <span>{formatDate(o.created_at)}</span>
                    </p>
                    <p className="text-xs mt-2 flex flex-wrap gap-2 items-center">
                      <span className="font-bold uppercase tracking-wide text-[10px]">{pay}</span>
                      {place && <span className="text-soul-muted">{place}</span>}
                      <span
                        className={`uppercase tracking-wide text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          o.status === "awaiting_payment"
                            ? "bg-orange-100 text-orange-800"
                            : o.status === "pending"
                              ? "bg-amber-100 text-amber-900"
                              : o.status === "processing"
                                ? "bg-sky-100 text-sky-900"
                                : "bg-neutral-100 text-soul-muted"
                        }`}
                      >
                        {o.status === "awaiting_payment" ? "awaiting payment" : o.status}
                      </span>
                      <span
                        className={`uppercase tracking-wide text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          paid ? "bg-emerald-100 text-emerald-900" : "bg-red-50 text-red-800"
                        }`}
                      >
                        {paid ? "money received" : "unpaid"}
                      </span>
                    </p>
                  </div>
                  <p className="font-bold text-base sm:text-lg shrink-0 tabular-nums">
                    {formatMMK(Number(o.total_cents) || 0)}
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-black/10 bg-white/50 p-3 space-y-2">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted">
                      Fulfillment
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {o.status === "awaiting_payment" && (
                        <p className="text-[11px] text-soul-muted w-full">
                          Mark paid first (verifies money &amp; reserves stock), then pack.
                        </p>
                      )}
                      {o.status === "pending" && (
                        <button
                          type="button"
                          disabled={savingId === o.id}
                          onClick={() => changeStatus(o.id, "processing")}
                          className="btn-soul--dark rounded-full px-4 min-h-[44px] text-[10px] disabled:opacity-50"
                        >
                          Start packaging
                        </button>
                      )}
                      {o.status === "processing" && (
                        <button
                          type="button"
                          disabled={savingId === o.id}
                          onClick={() => changeStatus(o.id, "shipped")}
                          className="btn-soul--dark rounded-full px-4 min-h-[44px] text-[10px] disabled:opacity-50"
                        >
                          Mark shipped
                        </button>
                      )}
                      {o.status === "shipped" && (
                        <button
                          type="button"
                          disabled={savingId === o.id}
                          onClick={() => changeStatus(o.id, "delivered")}
                          className="btn-soul--dark rounded-full px-4 min-h-[44px] text-[10px] disabled:opacity-50"
                        >
                          Mark delivered
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={printId === o.id}
                        onClick={() => void printOrder(o.id)}
                        className="px-4 py-2 rounded-full text-[10px] font-bold uppercase border border-black/10 min-h-[44px] disabled:opacity-50"
                      >
                        {printId === o.id ? "Printing…" : "Print slip"}
                      </button>
                      <button
                        type="button"
                        disabled={savingId === o.id}
                        onClick={() => void saveCustomer(o.id)}
                        className="px-4 py-2 rounded-full text-[10px] font-bold uppercase border border-black/10 min-h-[44px] disabled:opacity-50"
                      >
                        Save customer
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-black/10 bg-white/50 p-3 space-y-2">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted">
                      Money
                    </p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {onPaymentChange && !paid && o.status !== "cancelled" && (
                        <button
                          type="button"
                          disabled={savingId === o.id}
                          onClick={() => changePayment(o.id, true)}
                          className="rounded-full px-4 min-h-[44px] text-[10px] font-bold uppercase tracking-wider bg-emerald-800 text-white disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      )}
                      {onPaymentChange && paid && (
                        <button
                          type="button"
                          disabled={savingId === o.id}
                          onClick={() => {
                            if (confirm("Clear paid flag? Only if money was marked by mistake.")) {
                              void changePayment(o.id, false);
                            }
                          }}
                          className="px-4 py-2 rounded-full text-[10px] font-bold uppercase border border-black/10 min-h-[44px] disabled:opacity-50"
                        >
                          Undo paid
                        </button>
                      )}
                      <select
                        value={o.status}
                        disabled={savingId === o.id}
                        onChange={(e) => changeStatus(o.id, e.target.value)}
                        className="w-full sm:flex-1 text-xs px-3 py-2.5 rounded-xl border border-black/10 bg-white/60 min-h-[44px] capitalize disabled:opacity-50"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          );
        })}

        {pageItems.length === 0 && (
          <GlassCard className="p-8 text-center text-sm text-soul-muted">
            {q || status || payFilter !== "all"
              ? "No orders match these filters."
              : "No orders yet."}
          </GlassCard>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 rounded-full text-xs font-bold uppercase border border-black/10 disabled:opacity-40 min-h-[40px]"
          >
            Prev
          </button>
          <span className="text-xs text-soul-muted tabular-nums px-2">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-4 py-2 rounded-full text-xs font-bold uppercase border border-black/10 disabled:opacity-40 min-h-[40px]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
