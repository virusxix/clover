"use client";

/**
 * Admin ICONIC partner
 * --------------------
 * Send stock from the physical store → ICONIC; enter their monthly sold report.
 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  VariantStockPicker,
  variantsFromStock,
  type StockRow,
} from "@/components/admin/VariantStockPicker";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";

const field =
  "w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm min-h-[44px] bg-white/70";

type Transfer = {
  id: string;
  transferredAt: string;
  fromLocation: string;
  notes: string;
  unitsSent: number;
};

type Report = {
  id: string;
  reportMonth: string;
  notes: string;
  unitsSold: number;
  revenue: number;
};

export function AdminIconicTab() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [storeStock, setStoreStock] = useState<StockRow[]>([]);
  const [iconicStock, setIconicStock] = useState<StockRow[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [sendVariant, setSendVariant] = useState("");
  const [sendSize, setSendSize] = useState("M");
  const [reportVariant, setReportVariant] = useState("");
  const [reportSize, setReportSize] = useState("M");

  const storeVariants = useMemo(() => variantsFromStock(storeStock), [storeStock]);
  const reportVariants = useMemo(() => {
    const fromIconic = variantsFromStock(iconicStock);
    return fromIconic.length ? fromIconic : storeVariants;
  }, [iconicStock, storeVariants]);

  const load = () => {
    Promise.all([
      api<{ transfers: Transfer[] }>("/api/admin/ops/iconic/transfers"),
      api<{ reports: Report[] }>("/api/admin/ops/iconic/reports"),
      api<{ items: StockRow[] }>("/api/admin/ops/inventory?location=store"),
      api<{ items: StockRow[] }>("/api/admin/ops/inventory?location=iconic"),
    ])
      .then(([t, r, store, iconic]) => {
        setTransfers(t.transfers);
        setReports(r.reports);
        setStoreStock(store.items);
        setIconicStock(iconic.items);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  };

  useEffect(() => {
    load();
  }, []);

  const onTransfer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!sendVariant) {
      setError("Select a product");
      return;
    }
    setMsg("");
    setError("");
    setSaving(true);
    const fd = new FormData(form);
    try {
      await api("/api/admin/ops/iconic/transfers", {
        method: "POST",
        json: {
          notes: fd.get("notes") || "",
          items: [
            {
              variantId: sendVariant,
              size: sendSize,
              qty: Number(fd.get("qty")),
            },
          ],
        },
      });
      setMsg("Stock sent to ICONIC from store");
      form.reset();
      setSendVariant("");
      setSendSize("M");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSaving(false);
    }
  };

  const onReport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!reportVariant) {
      setError("Select a product");
      return;
    }
    setMsg("");
    setError("");
    setSaving(true);
    const fd = new FormData(form);
    try {
      await api("/api/admin/ops/iconic/reports", {
        method: "POST",
        json: {
          reportMonth: String(fd.get("reportMonth")),
          notes: fd.get("notes") || "",
          items: [
            {
              variantId: reportVariant,
              size: reportSize,
              qtySold: Number(fd.get("qtySold")),
              unitRevenue: Number(fd.get("unitRevenue")),
            },
          ],
        },
      });
      setMsg("Monthly ICONIC report saved — stock deducted");
      form.reset();
      setReportVariant("");
      setReportSize("M");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black tracking-tight">ICONIC partner</h2>
        <p className="text-sm text-soul-muted mt-2 max-w-2xl">
          Consignment always leaves your physical store for ICONIC. Enter their monthly sold report
          afterward — revenue per unit is what Clover receives (not always the retail tag price).
        </p>
      </div>

      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <p className="text-xs font-bold tracking-widest uppercase mb-3">Send stock to ICONIC</p>
          <p className="text-xs text-soul-muted mb-3">
            Source is always <span className="font-semibold text-soul-ink">Store</span> stock.
          </p>
          {storeVariants.length === 0 && (
            <p className="text-xs text-amber-700 mb-3">
              No store stock available — receive or transfer stock into Store first.
            </p>
          )}
          <form onSubmit={onTransfer} className="space-y-3">
            <VariantStockPicker
              variants={storeVariants}
              variantId={sendVariant}
              size={sendSize}
              emptyLabel="Select store product…"
              onVariantChange={(id, sizes) => {
                setSendVariant(id);
                if (sizes.length) setSendSize(sizes[0]);
              }}
              onSizeChange={setSendSize}
            />
            <input name="qty" required type="number" min={1} placeholder="Qty sent" className={field} />
            <input name="notes" placeholder="Notes" className={field} />
            <button
              type="submit"
              disabled={saving || !sendVariant}
              className="btn-soul--dark rounded-full w-full min-h-[44px] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Transfer store → ICONIC"}
            </button>
          </form>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-xs font-bold tracking-widest uppercase mb-3">Monthly sold report</p>
          <p className="text-[11px] text-soul-muted mb-3">
            Revenue per unit = amount ICONIC pays you for each sold piece (MMK). You can add more
            lines to the same month.
          </p>
          <form onSubmit={onReport} className="space-y-3">
            <input
              name="reportMonth"
              required
              type="month"
              className={field}
              aria-label="Report month"
            />
            <VariantStockPicker
              variants={reportVariants}
              variantId={reportVariant}
              size={reportSize}
              emptyLabel="Select product…"
              onVariantChange={(id, sizes) => {
                setReportVariant(id);
                if (sizes.length) setReportSize(sizes[0]);
              }}
              onSizeChange={setReportSize}
            />
            <input name="qtySold" required type="number" min={1} placeholder="Qty sold" className={field} />
            <input
              name="unitRevenue"
              required
              type="number"
              min={0}
              placeholder="Revenue per unit (MMK from ICONIC)"
              className={field}
            />
            <input name="notes" placeholder="Notes" className={field} />
            <button
              type="submit"
              disabled={saving || !reportVariant}
              className="btn-soul--dark rounded-full w-full min-h-[44px] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save report"}
            </button>
          </form>
        </GlassCard>
      </div>

      <GlassCard className="p-5 overflow-x-auto">
        <p className="text-xs font-bold tracking-widest uppercase mb-3">Transfers out (store → ICONIC)</p>
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="text-left text-xs text-soul-muted uppercase tracking-wider">
              <th className="py-2">Date</th>
              <th>From</th>
              <th>Units</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.id} className="border-t border-black/5">
                <td className="py-2">{String(t.transferredAt).slice(0, 10)}</td>
                <td>Store</td>
                <td>{t.unitsSent}</td>
                <td className="text-soul-muted">{t.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {transfers.length === 0 && (
          <p className="text-sm text-soul-muted py-4">No transfers yet.</p>
        )}
      </GlassCard>

      <GlassCard className="p-5 overflow-x-auto">
        <p className="text-xs font-bold tracking-widest uppercase mb-3">Monthly reports</p>
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="text-left text-xs text-soul-muted uppercase tracking-wider">
              <th className="py-2">Month</th>
              <th>Units</th>
              <th>Revenue</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-t border-black/5">
                <td className="py-2">{String(r.reportMonth).slice(0, 7)}</td>
                <td>{r.unitsSold}</td>
                <td>{formatMMK(r.revenue)}</td>
                <td className="text-soul-muted">{r.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {reports.length === 0 && (
          <p className="text-sm text-soul-muted py-4">No ICONIC reports yet.</p>
        )}
      </GlassCard>
    </div>
  );
}
