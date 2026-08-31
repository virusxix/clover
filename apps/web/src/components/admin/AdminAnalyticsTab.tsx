"use client";

/**
 * Admin analytics + market insights
 * ---------------------------------
 * Period summary, P&L by channel, export buttons, expert narrative.
 */

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";

type Period = "daily" | "weekly" | "monthly" | "yearly" | "overall";

type SummaryRow = {
  bucket: string | null;
  channel: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
};

type PlYear = {
  year: string | number;
  website: ChannelPl;
  store: ChannelPl;
  iconic: ChannelPl;
  overall: ChannelPl;
};

type ChannelPl = { units: number; revenue: number; cost: number; profit: number };

type Market = {
  narrative: string[];
  topMovers: { name: string; units: number; revenue: number }[];
  slowMovers: { name: string; color: string; size: string; location: string; qty: number; tiedUp: number }[];
  channelMix: { channel: string; units: number; revenue: number; sharePct: number }[];
  categoryMix: { category: string; units: number; revenue: number }[];
  stockHealth: { location: string; units: number; inventoryValue: number }[];
  sellThrough: { name: string; color: string; size: string; sold: number; onHand: number; sellThroughPct: number }[];
};

const PERIODS: Period[] = ["daily", "weekly", "monthly", "yearly", "overall"];

export function AdminAnalyticsTab() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [pl, setPl] = useState<PlYear[]>([]);
  const [market, setMarket] = useState<Market | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    Promise.all([
      api<{ rows: SummaryRow[] }>(`/api/admin/ops/analytics/summary?period=${period}`),
      api<{ years: PlYear[] }>("/api/admin/ops/analytics/profit-loss"),
      api<Market>("/api/admin/ops/analytics/market"),
    ])
      .then(([s, p, m]) => {
        setRows(s.rows);
        setPl(p.years);
        setMarket(m);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analytics"));
  }, [period]);

  const exportUrl = (kind: string) => {
    // Same-origin rewrite; open in new tab for download
    window.open(`/api/admin/ops/export/${kind}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-black tracking-tight">Analytics & market</h2>
        <div className="flex flex-wrap gap-2">
          {(["inventory", "sales-summary", "profit-loss", "iconic"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => exportUrl(kind)}
              className="px-3 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase glass min-h-[40px]"
            >
              Export {kind}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 rounded-xl bg-red-50 border border-red-200 px-4 py-3">{error}</p>
      )}

      {market && (
        <GlassCard className="p-5 sm:p-6 space-y-3">
          <p className="text-xs font-bold tracking-widest uppercase">Market brief</p>
          {market.narrative.map((line) => (
            <p key={line} className="text-sm text-soul-muted leading-relaxed">
              {line}
            </p>
          ))}
        </GlassCard>
      )}

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase min-h-[40px] ${
              period === p ? "bg-black text-white" : "glass"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <GlassCard className="p-5 overflow-x-auto">
        <p className="text-xs font-bold tracking-widest uppercase mb-3">Sales by channel ({period})</p>
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-left text-soul-muted text-xs uppercase tracking-wider">
              <th className="py-2">Period</th>
              <th>Channel</th>
              <th>Units</th>
              <th>Revenue</th>
              <th>Cost</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-soul-muted">
                  No sales in this view yet.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.bucket}-${r.channel}-${i}`} className="border-t border-black/5">
                  <td className="py-2">{formatBucket(r.bucket)}</td>
                  <td className="capitalize">{r.channel}</td>
                  <td>{r.units}</td>
                  <td>{formatMMK(r.revenue)}</td>
                  <td>{formatMMK(r.cost)}</td>
                  <td className={r.profit >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                    {formatMMK(r.profit)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </GlassCard>

      <GlassCard className="p-5 overflow-x-auto">
        <p className="text-xs font-bold tracking-widest uppercase mb-3">Annual profit & loss</p>
        {pl.length === 0 ? (
          <p className="text-sm text-soul-muted">No P&L data yet. Set cost on variants and record sales.</p>
        ) : (
          <div className="space-y-4">
            {pl.map((y) => (
              <div key={String(y.year)} className="border-t border-black/5 pt-3 first:border-0 first:pt-0">
                <p className="font-bold mb-2">{y.year}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  {(["website", "store", "iconic", "overall"] as const).map((ch) => (
                    <div key={ch} className="rounded-xl bg-black/[0.03] p-3">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted mb-1">
                        {ch}
                      </p>
                      <p>Rev {formatMMK(y[ch].revenue)}</p>
                      <p>Cost {formatMMK(y[ch].cost)}</p>
                      <p className="font-semibold">P/L {formatMMK(y[ch].profit)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {market && (
        <div className="grid lg:grid-cols-2 gap-4">
          <GlassCard className="p-5">
            <p className="text-xs font-bold tracking-widest uppercase mb-3">Top movers (90d)</p>
            {market.topMovers.map((t) => (
              <div key={t.name} className="flex justify-between text-sm py-1.5 gap-2">
                <span className="truncate font-medium">{t.name}</span>
                <span className="text-soul-muted shrink-0">
                  {t.units} · {formatMMK(t.revenue)}
                </span>
              </div>
            ))}
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-xs font-bold tracking-widest uppercase mb-3">Channel mix</p>
            {market.channelMix.map((c) => (
              <div key={c.channel} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize font-medium">{c.channel}</span>
                  <span>{c.sharePct}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                  <div className="h-full bg-black rounded-full" style={{ width: `${c.sharePct}%` }} />
                </div>
              </div>
            ))}
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-xs font-bold tracking-widest uppercase mb-3">Sell-through (30d)</p>
            {market.sellThrough.length === 0 ? (
              <p className="text-sm text-soul-muted">No recent sell-through data.</p>
            ) : (
              market.sellThrough.map((s) => (
                <div key={`${s.name}-${s.size}`} className="flex justify-between text-sm py-1.5 gap-2">
                  <span className="truncate">
                    {s.name} · {s.size}
                  </span>
                  <span className="font-medium shrink-0">{s.sellThroughPct}%</span>
                </div>
              ))
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-xs font-bold tracking-widest uppercase mb-3">Slow movers (45d quiet)</p>
            {market.slowMovers.length === 0 ? (
              <p className="text-sm text-soul-muted">No slow stock flagged.</p>
            ) : (
              market.slowMovers.slice(0, 6).map((s) => (
                <div key={`${s.name}-${s.location}-${s.size}`} className="text-sm py-1.5">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-soul-muted">
                    {" "}
                    · {s.size} @ {s.location} ×{s.qty}
                  </span>
                </div>
              ))
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function formatBucket(bucket: string | null) {
  if (!bucket || bucket === "overall") return "Overall";
  try {
    return new Date(bucket).toLocaleDateString();
  } catch {
    return String(bucket);
  }
}
