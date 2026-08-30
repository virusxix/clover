"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";

type Props = {
  saleDiscountPercent: number;
  onUpdated: (percent: number) => void;
};

export function AdminSaleSettings({ saleDiscountPercent, onUpdated }: Props) {
  const [value, setValue] = useState(String(saleDiscountPercent));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setValue(String(saleDiscountPercent));
  }, [saleDiscountPercent]);

  const save = async () => {
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 1 || n > 90) {
      setMsg("Enter a whole number between 1 and 90.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await api<{ saleDiscountPercent: number }>("/api/admin/settings", {
        method: "PATCH",
        json: { saleDiscountPercent: n },
      });
      onUpdated(res.saleDiscountPercent);
      setValue(String(res.saleDiscountPercent));
      setMsg("Saved — all sale items use this discount.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard className="p-5 sm:p-6 sm:col-span-2 lg:col-span-4">
      <p className="text-xs font-bold tracking-widest uppercase text-soul-muted mb-1">Store sale discount</p>
      <p className="text-sm text-soul-muted mb-4">
        Applies to every product with the <strong className="text-soul-sale">Sale</strong> tag. Admin price = original;
        customers pay the discounted amount.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="flex-1 max-w-[12rem]">
          <span className="text-xs font-bold tracking-widest uppercase text-soul-muted block mb-1">Percent off</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={90}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 bg-white/60 text-base sm:text-sm min-h-[44px]"
            />
            <span className="text-sm font-semibold shrink-0">%</span>
          </div>
        </label>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-soul--dark rounded-full px-6 py-2.5 text-xs font-bold tracking-widest uppercase min-h-[44px] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {msg && <p className={`text-sm mt-3 ${msg.startsWith("Saved") ? "text-green-700" : "text-red-600"}`}>{msg}</p>}
    </GlassCard>
  );
}
