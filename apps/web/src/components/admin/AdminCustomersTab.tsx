"use client";

/**
 * Customer CRM — new / regular / loyal / vip
 */

import { FormEvent, useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";

const SEGMENTS = [
  { id: "new", label: "New" },
  { id: "regular", label: "Regular" },
  { id: "loyal", label: "Loyal" },
  { id: "vip", label: "VIP" },
] as const;

export type CrmCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  segment: string;
  notes?: string;
  orderCount?: number;
  storeSaleCount?: number;
  createdAt?: string;
};

const field =
  "w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm min-h-[44px] bg-white/70";

function segmentClass(segment: string) {
  if (segment === "vip") return "bg-black text-white";
  if (segment === "loyal") return "bg-emerald-800 text-white";
  if (segment === "regular") return "bg-sky-800 text-white";
  return "bg-neutral-100 text-soul-muted";
}

export function AdminCustomersTab() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newSegment, setNewSegment] = useState<string>("new");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (segment) params.set("segment", segment);
      const d = await api<{ customers: CrmCustomer[] }>(
        `/api/admin/ops/customers?${params.toString()}`
      );
      setCustomers(d.customers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [segment]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusyId("new");
    setError("");
    try {
      await api("/api/admin/ops/customers", {
        method: "POST",
        json: {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          segment: newSegment,
          notes: notes.trim(),
        },
      });
      setName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setNewSegment("new");
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create customer");
    } finally {
      setBusyId(null);
    }
  };

  const setCustomerSegment = async (id: string, next: string) => {
    setBusyId(id);
    setError("");
    try {
      const res = await api<{ customer: CrmCustomer }>(`/api/admin/ops/customers/${id}`, {
        method: "PATCH",
        json: { segment: next },
      });
      setCustomers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, segment: res.customer.segment } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update segment");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-tight">Customers</h2>
          <p className="text-sm text-soul-muted mt-1 max-w-xl">
            Walk-in and website shoppers — tag as new, regular, loyal, or VIP. Link from orders via
            Save customer, or attach on POS.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="btn-soul--dark rounded-full px-5 min-h-[44px] text-[10px] w-fit"
        >
          {formOpen ? "Close" : "Add customer"}
        </button>
      </div>

      {formOpen && (
        <GlassCard className="p-4 sm:p-5">
          <form onSubmit={create} className="grid sm:grid-cols-2 gap-3">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className={field}
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className={field}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              className={field}
            />
            <select
              value={newSegment}
              onChange={(e) => setNewSegment(e.target.value)}
              className={field}
              aria-label="Segment"
            >
              {SEGMENTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (sizes, preferences…)"
              rows={2}
              className={`${field} sm:col-span-2 min-h-[72px]`}
            />
            <button
              type="submit"
              disabled={busyId === "new"}
              className="btn-soul--dark rounded-full min-h-[48px] text-xs sm:col-span-2 disabled:opacity-50"
            >
              {busyId === "new" ? "Saving…" : "Save customer"}
            </button>
          </form>
        </GlassCard>
      )}

      <GlassCard className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
            placeholder="Search name, phone, email…"
            className={`${field} flex-1`}
          />
          <button
            type="button"
            onClick={() => void load()}
            className="btn-soul--glass rounded-full px-5 min-h-[44px] text-[10px]"
          >
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSegment("")}
            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
              !segment ? "bg-black text-white border-black" : "border-black/10 text-soul-muted"
            }`}
          >
            All
          </button>
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSegment(s.id)}
              className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                segment === s.id
                  ? "bg-black text-white border-black"
                  : "border-black/10 text-soul-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {error && (
        <p className="text-sm text-red-600 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-soul-muted py-8 text-center">Loading…</p>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <GlassCard
              key={c.id}
              className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{c.name}</p>
                <p className="text-sm text-soul-muted mt-0.5 flex flex-wrap gap-x-2">
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span className="break-all">{c.email}</span>}
                </p>
                <p className="text-[11px] text-soul-muted mt-1">
                  {(c.orderCount || 0) + (c.storeSaleCount || 0)} visits · web {c.orderCount || 0} ·
                  store {c.storeSaleCount || 0}
                </p>
                {c.notes ? (
                  <p className="text-xs text-soul-muted mt-1 line-clamp-2">{c.notes}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${segmentClass(
                    c.segment
                  )}`}
                >
                  {c.segment}
                </span>
                <select
                  value={c.segment}
                  disabled={busyId === c.id}
                  onChange={(e) => void setCustomerSegment(c.id, e.target.value)}
                  className="px-2.5 py-2 rounded-xl border border-black/10 text-xs font-semibold bg-white min-h-[40px]"
                  aria-label={`Segment for ${c.name}`}
                >
                  {SEGMENTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </GlassCard>
          ))}
          {customers.length === 0 && (
            <GlassCard className="p-8 text-center text-sm text-soul-muted">
              No customers yet. Add one, or save from an order / POS sale.
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
}
