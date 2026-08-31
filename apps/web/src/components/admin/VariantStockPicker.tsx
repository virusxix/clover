"use client";

/**
 * Shared product/variant picker for admin ops forms.
 * One job: choose a catalog variant + size without typing UUIDs.
 */

import { useMemo } from "react";

export const ADMIN_SIZES = ["XS", "S", "M", "L", "XL"] as const;

export type CatalogVariant = {
  variantId: string;
  productName: string;
  productCode?: string | null;
  colorName: string;
  price?: number;
};

export type StockRow = {
  variantId: string;
  productName: string;
  productCode?: string | null;
  colorName: string;
  size: string;
  qty: number;
};

const field =
  "w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm min-h-[44px] bg-white/70";

export function labelForVariant(v: {
  productName: string;
  productCode?: string | null;
  colorName: string;
  suffix?: string;
}) {
  const code = v.productCode ? `${v.productCode} · ` : "";
  return `${code}${v.productName} — ${v.colorName}${v.suffix || ""}`;
}

/** Unique variants from stock rows (keeps sizes that have qty). */
export function variantsFromStock(rows: StockRow[]) {
  const map = new Map<
    string,
    { variantId: string; label: string; sizes: string[]; price?: number }
  >();
  for (const r of rows) {
    const existing = map.get(r.variantId);
    if (existing) {
      if (!existing.sizes.includes(r.size)) existing.sizes.push(r.size);
    } else {
      map.set(r.variantId, {
        variantId: r.variantId,
        label: labelForVariant(r),
        sizes: [r.size],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function variantsFromCatalog(rows: CatalogVariant[]) {
  return rows
    .map((r) => ({
      variantId: r.variantId,
      label: labelForVariant(r),
      sizes: [...ADMIN_SIZES],
      price: r.price,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

type Props = {
  variants: { variantId: string; label: string; sizes: string[]; price?: number }[];
  variantId: string;
  size: string;
  onVariantChange: (variantId: string, sizes: string[], price?: number) => void;
  onSizeChange: (size: string) => void;
  emptyLabel?: string;
  disabled?: boolean;
};

export function VariantStockPicker({
  variants,
  variantId,
  size,
  onVariantChange,
  onSizeChange,
  emptyLabel = "Select product…",
  disabled,
}: Props) {
  const sizes = useMemo(() => {
    const found = variants.find((v) => v.variantId === variantId);
    return found?.sizes?.length ? found.sizes : [...ADMIN_SIZES];
  }, [variants, variantId]);

  return (
    <div className="space-y-3">
      <select
        required
        disabled={disabled}
        value={variantId}
        onChange={(e) => {
          const id = e.target.value;
          const found = variants.find((v) => v.variantId === id);
          onVariantChange(id, found?.sizes ?? [...ADMIN_SIZES], found?.price);
        }}
        className={field}
      >
        <option value="">{emptyLabel}</option>
        {variants.map((v) => (
          <option key={v.variantId} value={v.variantId}>
            {v.label}
          </option>
        ))}
      </select>
      <select
        required
        disabled={disabled || !variantId}
        value={size}
        onChange={(e) => onSizeChange(e.target.value)}
        className={field}
        aria-label="Size"
      >
        {sizes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
