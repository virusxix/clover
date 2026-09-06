"use client";

/**
 * Reception order alerts
 * ----------------------
 * While admin is open: poll for new website orders, browser-notify,
 * and auto-print the invoice receipt on the XP-80C (or selected paper).
 */

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";
import { PAYMENT_LABELS } from "@/lib/payments";
import {
  loadPaperWidth,
  printReceipt,
  type ReceiptData,
} from "@/components/admin/pos/PosReceipt";

const SEEN_KEY = "clover-reception-seen-orders";
const POLL_MS = 8000;

type FeedOrder = {
  id: string;
  status: string;
  totalCents: number;
  paymentMethod?: string | null;
  shippingName?: string;
  createdAt: string;
};

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  const arr = Array.from(seen).slice(-200);
  sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr));
}

export function ReceptionOrderAlerts() {
  const [banner, setBanner] = useState<FeedOrder | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const sinceRef = useRef(new Date().toISOString());
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    seenRef.current = loadSeen();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const data = await api<{ serverTime: string; orders: FeedOrder[] }>(
          `/api/admin/orders/feed?since=${encodeURIComponent(sinceRef.current)}`
        );
        if (cancelled) return;

        // First poll: mark existing as seen so we don't reprint history
        if (!primedRef.current) {
          for (const o of data.orders) seenRef.current.add(o.id);
          saveSeen(seenRef.current);
          primedRef.current = true;
          sinceRef.current = data.serverTime || new Date().toISOString();
          return;
        }

        const fresh = data.orders.filter((o) => !seenRef.current.has(o.id));
        for (const o of fresh) {
          seenRef.current.add(o.id);
          setBanner(o);
          notifyBrowser(o);
          if (autoPrint) {
            await printWebOrder(o.id);
          }
        }
        if (fresh.length) saveSeen(seenRef.current);
        sinceRef.current = data.serverTime || new Date().toISOString();
      } catch {
        /* reception poll is best-effort */
      }
    };

    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, autoPrint]);

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-soul-muted">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Reception alerts
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoPrint}
            onChange={(e) => setAutoPrint(e.target.checked)}
            disabled={!enabled}
          />
          Auto-print new web orders
        </label>
      </div>

      {banner && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-emerald-950">New website order</p>
            <p className="text-xs text-emerald-900/80 mt-0.5 truncate">
              #{banner.id.slice(0, 8)} · {banner.shippingName || "Customer"} ·{" "}
              {PAYMENT_LABELS[banner.paymentMethod || ""] || banner.paymentMethod || "—"} ·{" "}
              {formatMMK(banner.totalCents)}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="px-3 py-2 rounded-full text-[10px] font-bold uppercase bg-black text-white min-h-[40px]"
              onClick={() => void printWebOrder(banner.id)}
            >
              Print again
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-full text-[10px] font-bold uppercase border border-black/15 min-h-[40px]"
              onClick={() => setBanner(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function notifyBrowser(o: FeedOrder) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification("THE CLOVER — new order", {
      body: `${o.shippingName || "Customer"} · ${formatMMK(o.totalCents)} · ${
        PAYMENT_LABELS[o.paymentMethod || ""] || o.paymentMethod || "paid"
      }`,
      tag: o.id,
    });
  } catch {
    /* ignore */
  }
}

async function printWebOrder(orderId: string) {
  try {
    const receipt = await api<ReceiptData>(`/api/admin/orders/${orderId}/receipt`);
    printReceipt(receipt, loadPaperWidth(), "website");
  } catch (err) {
    console.error("[reception] print failed", err);
  }
}
