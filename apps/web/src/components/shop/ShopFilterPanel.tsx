"use client";

/**
 * Shop filter panel UI
 * --------------------
 * One job: render category / size / price controls.
 * Parent owns the filter state and product fetching.
 */

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "jackets", label: "Jackets" },
  { id: "long-sleeve", label: "Long Sleeve" },
  { id: "short-sleeve", label: "Short Sleeve" },
  { id: "shorts", label: "Shorts" },
  { id: "skirts", label: "Skirts" },
  { id: "leggings", label: "Leggings" },
  { id: "flare-pants", label: "Flare Pants" },
  { id: "biker-pants", label: "Biker Pants" },
  { id: "tops", label: "Tops & Bras" },
];

const SIZES = ["XS", "S", "M", "L", "XL"];

export type ShopFilterValues = {
  category: string;
  size: string;
  minPrice: string;
  maxPrice: string;
};

type Props = ShopFilterValues & {
  setCategory: (v: string) => void;
  setSize: (v: string) => void;
  setMinPrice: (v: string) => void;
  setMaxPrice: (v: string) => void;
};

export function ShopFilterPanel({
  category,
  setCategory,
  size,
  setSize,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
}: Props) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <FilterGroup label="Category">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id || "all"}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Size">
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <Chip
              key={s}
              active={size === s}
              onClick={() => setSize(size === s ? "" : s)}
              className="min-w-[2.75rem] h-11 justify-center"
            >
              {s}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Price">
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full min-w-0 px-3 py-2.5 text-sm rounded-xl border border-black/10 bg-white/50 min-h-[44px]"
          />
          <input
            type="number"
            placeholder="Max (Ks)"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full min-w-0 px-3 py-2.5 text-sm rounded-xl border border-black/10 bg-white/50 min-h-[44px]"
          />
        </div>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold tracking-widest uppercase mb-3">{label}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2.5 text-xs rounded-full border transition-all min-h-[40px] touch-manipulation inline-flex items-center ${
        active ? "bg-black text-white border-black" : "border-black/10 hover:border-black/30"
      } ${className}`}
    >
      {children}
    </button>
  );
}
