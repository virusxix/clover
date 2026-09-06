"use client";

/**
 * Admin orders list
 * -----------------
 * Recent website orders — start packaging, advance status, see payment method.
 */

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatMMK } from "@/lib/currency";
import { PAYMENT_LABELS } from "@/lib/payments";
import { loadPaperWidth, printReceipt, type ReceiptData } from "@/components/admin/pos/PosReceipt";
import { api } from "@/lib/api";

const PAGE_SIZE = 12;
const STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

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
};

type Props = {
  orders: AdminOrder[];
  onStatusChange: (orderId: string, status: string) => Promise<void>;
};

function dedupeOrders(orders: AdminOrder[]) {
  const map = new Map<string, AdminOrder>();
  for (const o of orders) {
    if (!o?.id || map.has(o.id)) continue;
    map.set(o.id, o);
  }
  return Array.from(map.values());
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

export function AdminOrdersTab({ orders, onStatusChange }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("pending");
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
      if (!needle) return true;
      const hay = `${o.id} ${o.email || ""} ${o.full_name || ""} ${o.shipping_name || ""} ${
        o.payment_method || ""
      }`.toLowerCase();
      return hay.includes(needle);
    });
  }, [orders, q, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STATUSES) c[s] = 0;
    for (const o of dedupeOrders(orders)) {
      c[o.status] = (c[o.status] || 0) + 1;
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
          <p className="text-xs text-soul-muted mt-1">
            New website orders arrive as <strong>pending</strong> — start packaging, then ship.
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
              setStatus("");
              setPage(1);
            }}
            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
              !status ? "bg-black text-white border-black" : "border-black/10 text-soul-muted"
            }`}
          >
            All
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

      <div className="space-y-2">
        {pageItems.map((o) => {
          const pay = PAYMENT_LABELS[o.payment_method || ""] || o.payment_method || "—";
          const place = [o.shipping_city, o.shipping_state].filter(Boolean).join(", ");
          return (
            <GlassCard key={o.id} className="p-3 sm:p-4">
              <div className="flex flex-col gap-3">
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
                    <p className="text-xs mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="font-bold uppercase tracking-wide text-[10px]">{pay}</span>
                      {place && <span className="text-soul-muted">{place}</span>}
                      <span
                        className={`uppercase tracking-wide text-[10px] font-bold ${
                          o.status === "pending"
                            ? "text-amber-800"
                            : o.status === "processing"
                              ? "text-sky-800"
                              : "text-soul-muted"
                        }`}
                      >
                        {o.status}
                      </span>
                    </p>
                  </div>
                  <p className="font-bold text-sm sm:text-base shrink-0 tabular-nums">
                    {formatMMK(Number(o.total_cents) || 0)}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  {o.status === "pending" && (
                    <button
                      type="button"
                      disabled={savingId === o.id}
                      onClick={() => changeStatus(o.id, "processing")}
                      className="btn-soul--dark rounded-full px-4 min-h-[44px] text-[10px] disabled:opacity-50"
                    >
                      {savingId === o.id ? "Updating…" : "Start packaging"}
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
                  <button
                    type="button"
                    disabled={printId === o.id}
                    onClick={() => void printOrder(o.id)}
                    className="px-4 py-2 rounded-full text-[10px] font-bold uppercase border border-black/10 min-h-[44px] disabled:opacity-50"
                  >
                    {printId === o.id ? "Printing…" : "Print receipt"}
                  </button>
                  <select
                    value={o.status}
                    disabled={savingId === o.id}
                    onChange={(e) => changeStatus(o.id, e.target.value)}
                    className="w-full sm:w-40 text-xs px-3 py-2.5 rounded-xl border border-black/10 bg-white/60 min-h-[44px] capitalize disabled:opacity-50 sm:ml-auto"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </GlassCard>
          );
        })}

        {pageItems.length === 0 && (
          <GlassCard className="p-8 text-center text-sm text-soul-muted">
            {q || status ? "No orders match these filters." : "No orders yet."}
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
