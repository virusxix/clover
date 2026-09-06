"use client";

import { useCallback, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PriceDisplay } from "@/components/shop/PriceDisplay";
import { ProductImagePicker } from "@/components/admin/ProductImagePicker";
import { api } from "@/lib/api";
import { describeProductCode } from "@/lib/product-code";

const SIZES = ["XS", "S", "M", "L", "XL"] as const;
const PAGE_SIZE = 12;

const CATEGORIES = [
  { id: "jackets", label: "Jackets" },
  { id: "long-sleeve", label: "Long Sleeve" },
  { id: "short-sleeve", label: "Short Sleeve" },
  { id: "shorts", label: "Shorts" },
  { id: "skirts", label: "Skirts" },
  { id: "leggings", label: "Leggings" },
  { id: "flare-pants", label: "Flare Pants" },
  { id: "biker-pants", label: "Biker Pants" },
  { id: "tops", label: "Tops & Bras" },
  { id: "accessories", label: "Accessories" },
];

export type AdminVariant = {
  id: string;
  variant_key: string;
  color_name: string;
  color_hex: string;
  price_cents: number;
  stock: Record<string, number>;
  image_url?: string;
};

export type AdminProduct = {
  id: string;
  slug: string;
  product_code?: string | null;
  name: string;
  description: string;
  category_id: string | null;
  gender: string;
  featured: boolean;
  tags: string[];
  variants: AdminVariant[];
};

type StockState = Record<string, string>;

const emptyStock = (): StockState =>
  Object.fromEntries(SIZES.map((s) => [s, "0"])) as StockState;

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function stockFromVariant(v?: AdminVariant): StockState {
  const s = emptyStock();
  if (!v?.stock) return s;
  for (const size of SIZES) {
    s[size] = String(v.stock[size] ?? 0);
  }
  return s;
}

function stockToPayload(stock: StockState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const size of SIZES) {
    const n = parseInt(stock[size], 10);
    out[size] = Number.isNaN(n) ? 0 : Math.max(0, n);
  }
  return out;
}

function totalStock(stock: Record<string, number> | StockState) {
  return Object.values(stock).reduce((sum, n) => sum + (parseInt(String(n), 10) || 0), 0);
}

function productTotalStock(p: AdminProduct) {
  return (p.variants || []).reduce((sum, v) => sum + totalStock(v.stock || {}), 0);
}

/** One row per product id; unique variants by id; unique tags. */
function normalizeCatalog(products: AdminProduct[]): AdminProduct[] {
  const byId = new Map<string, AdminProduct>();
  for (const p of products) {
    if (!p?.id || byId.has(p.id)) continue;
    const seenVariant = new Set<string>();
    const variants: AdminVariant[] = [];
    for (const v of p.variants || []) {
      if (!v?.id || seenVariant.has(v.id)) continue;
      seenVariant.add(v.id);
      variants.push(v);
    }
    const tags = Array.from(new Set((p.tags || []).map((t) => t.trim()).filter(Boolean)));
    byId.set(p.id, { ...p, variants, tags });
  }
  return Array.from(byId.values());
}

function salePreview(priceStr: string, onSale: boolean, saleDiscountPercent: number) {
  const original = parseFloat(priceStr);
  if (!onSale || Number.isNaN(original) || original <= 0) return null;
  const sale = Math.round((original * (100 - saleDiscountPercent)) / 100);
  return { original, sale };
}

function SalePriceHint({
  price,
  onSale,
  saleDiscountPercent,
}: {
  price: string;
  onSale: boolean;
  saleDiscountPercent: number;
}) {
  const preview = salePreview(price, onSale, saleDiscountPercent);
  if (!preview) return null;
  return (
    <p className="text-sm mt-2 flex flex-wrap items-center gap-2">
      <span className="text-soul-muted">Customers see:</span>
      <PriceDisplay
        price={preview.sale}
        compareAtPrice={preview.original}
        onSale
        discountPercent={saleDiscountPercent}
        size="sm"
        showBadge
      />
    </p>
  );
}

type FormState = {
  name: string;
  slug: string;
  productCode: string;
  description: string;
  categoryId: string;
  price: string;
  colorName: string;
  colorHex: string;
  imageUrl: string;
  customTags: string;
  tagNew: boolean;
  tagSale: boolean;
  featured: boolean;
  stock: StockState;
};

const emptyForm = (): FormState => ({
  name: "",
  slug: "",
  productCode: "",
  description: "",
  categoryId: "tops",
  price: "",
  colorName: "Black",
  colorHex: "#1a1a1a",
  imageUrl: "",
  customTags: "",
  tagNew: false,
  tagSale: false,
  featured: false,
  stock: emptyStock(),
});

type Props = {
  products: AdminProduct[];
  onRefresh: () => void;
  saleDiscountPercent: number;
};

export function AdminProductsTab({ products, onRefresh, saleDiscountPercent }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [editVariantId, setEditVariantId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [catalogQ, setCatalogQ] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("");
  const [page, setPage] = useState(1);

  const catalog = useMemo(() => {
    const normalized = normalizeCatalog(products);
    const needle = catalogQ.trim().toLowerCase();
    return normalized.filter((p) => {
      if (catalogCategory && p.category_id !== catalogCategory) return false;
      if (!needle) return true;
      const hay = `${p.name} ${p.slug} ${p.product_code || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [products, catalogQ, catalogCategory]);

  const totalPages = Math.max(1, Math.ceil(catalog.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return catalog.slice(start, start + PAGE_SIZE);
  }, [catalog, safePage]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const applyBulkQty = (target: "add" | "edit", qty: string) => {
    const n = String(Math.max(0, parseInt(qty, 10) || 0));
    const next = Object.fromEntries(SIZES.map((s) => [s, n])) as StockState;
    if (target === "add") setForm((f) => ({ ...f, stock: next }));
    else if (editForm) setEditForm({ ...editForm, stock: next });
  };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const tags = form.customTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await api("/api/admin/products", {
        method: "POST",
        json: {
          slug: form.slug || slugify(form.name),
          name: form.name,
          description: form.description,
          categoryId: form.categoryId,
          gender: "women",
          activity: "training",
          featured: form.featured,
          tags,
          tagNew: form.tagNew,
          tagSale: form.tagSale,
          price: parseFloat(form.price),
          colorName: form.colorName,
          colorHex: form.colorHex,
          imageUrl: form.imageUrl || undefined,
          stock: stockToPayload(form.stock),
          productCode: form.productCode.trim(),
        },
      });
      setForm(emptyForm());
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = useCallback((p: AdminProduct) => {
    const v = p.variants[0];
    setEditingId(p.id);
    setEditVariantId(v?.id ?? null);
    setEditForm({
      name: p.name,
      slug: p.slug,
      productCode: p.product_code || "",
      description: p.description || "",
      categoryId: p.category_id || "tops",
      price: v ? String(v.price_cents) : "",
      colorName: v?.color_name || "Black",
      colorHex: v?.color_hex || "#1a1a1a",
      imageUrl: v?.image_url || "",
      customTags: (p.tags || []).filter((t) => !["new", "sale"].includes(t)).join(", "),
      tagNew: p.tags?.includes("new") ?? false,
      tagSale: p.tags?.includes("sale") ?? false,
      featured: p.featured,
      stock: stockFromVariant(v),
    });
    setError("");
  }, []);

  const saveEdit = async () => {
    if (!editingId || !editForm || !editVariantId) return;
    setError("");
    setSaving(true);
    try {
      const tags = editForm.customTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await api(`/api/admin/products/${editingId}`, {
        method: "PATCH",
        json: {
          name: editForm.name,
          slug: editForm.slug,
          description: editForm.description,
          categoryId: editForm.categoryId,
          featured: editForm.featured,
          tags,
          tagNew: editForm.tagNew,
          tagSale: editForm.tagSale,
          productCode: editForm.productCode.trim() || undefined,
        },
      });
      await api(`/api/admin/products/${editingId}/variants/${editVariantId}`, {
        method: "PATCH",
        json: {
          price: parseFloat(editForm.price),
          colorName: editForm.colorName,
          colorHex: editForm.colorHex,
          stock: stockToPayload(editForm.stock),
          imageUrl: editForm.imageUrl || undefined,
        },
      });
      setEditingId(null);
      setEditForm(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await api(`/api/admin/products/${id}`, { method: "DELETE" });
      if (editingId === id) {
        setEditingId(null);
        setEditForm(null);
      }
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full min-w-0 px-3 py-2.5 sm:py-2 rounded-xl border border-black/10 bg-white/60 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-black/10";

  const TagCheckboxes = ({
    state,
    set,
  }: {
    state: Pick<FormState, "tagNew" | "tagSale" | "featured">;
    set: (patch: Partial<FormState>) => void;
  }) => (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={state.tagNew} onChange={(e) => set({ tagNew: e.target.checked })} />
        <span className="font-semibold">New In</span>
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={state.tagSale}
          onChange={(e) => set({ tagSale: e.target.checked })}
          className="accent-red-600"
        />
        <span className="font-semibold text-soul-sale">Sale</span>
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={state.featured} onChange={(e) => set({ featured: e.target.checked })} />
        <span>Featured (home)</span>
      </label>
    </div>
  );

  const StockGrid = ({
    stock,
    onChange,
    bulkTarget,
  }: {
    stock: StockState;
    onChange: (size: string, val: string) => void;
    bulkTarget: "add" | "edit";
  }) => (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs font-bold tracking-widest uppercase text-soul-muted w-full sm:w-auto">Quantity by size</span>
        <input
          type="number"
          min={0}
          placeholder="Set all"
          className="w-24 px-2 py-2 rounded-lg border border-black/10 text-sm min-h-[40px]"
          onBlur={(e) => {
            if (e.target.value) applyBulkQty(bulkTarget, e.target.value);
            e.target.value = "";
          }}
        />
        <span className="text-[10px] text-soul-muted hidden sm:inline">blur to apply to all sizes</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {SIZES.map((size) => (
          <label key={size} className="text-center">
            <span className="text-[10px] font-bold text-soul-muted block mb-1">{size}</span>
            <input
              type="number"
              min={0}
              value={stock[size]}
              onChange={(e) => onChange(size, e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-black/10 text-sm text-center"
            />
          </label>
        ))}
      </div>
      <p className="text-[10px] text-soul-muted mt-1">
        Total units: {totalStock(stock)}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <GlassCard className="overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="w-full text-left px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-black/[0.02] min-h-[48px]"
        >
          <span className="text-base sm:text-lg font-black tracking-tight">Add product</span>
          <span className={`text-soul-muted text-xs transition-transform ${showAdd ? "rotate-90" : ""}`}>
            ▸
          </span>
        </button>

        {showAdd && (
          <form onSubmit={createProduct} className="space-y-4 border-t border-black/5 px-4 sm:px-6 pb-5 pt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold tracking-widest uppercase text-soul-muted block mb-1">Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      slug: f.slug || slugify(name),
                    }));
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest uppercase text-soul-muted block mb-1">Product code *</label>
                <input
                  required
                  value={form.productCode}
                  onChange={(e) => setField("productCode", e.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="Any code — SO1pljk, JK-001, BRA_RED…"
                  maxLength={32}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p className="text-[11px] text-soul-muted mt-1">
                  Your own product code (letters, numbers, -, _, .)
                  {form.productCode.trim() &&
                    describeProductCode(form.productCode.trim()) !== form.productCode.trim() && (
                      <> · {describeProductCode(form.productCode.trim())}</>
                    )}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold tracking-widest uppercase text-soul-muted block mb-1">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => setField("slug", e.target.value)}
                className={inputClass}
                placeholder="auto-from-name"
              />
            </div>

            <div>
              <label className="text-xs font-bold tracking-widest uppercase text-soul-muted block mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={2}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold tracking-widest uppercase text-soul-muted block mb-1">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setField("categoryId", e.target.value)}
                  className={inputClass}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest uppercase text-soul-muted block mb-1">
                  Price (MMK) *
                </label>
                <input
                  required
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  className={inputClass}
                />
                <SalePriceHint
                  price={form.price}
                  onSale={form.tagSale}
                  saleDiscountPercent={saleDiscountPercent}
                />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest uppercase text-soul-muted block mb-1">Color</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={form.colorName}
                    onChange={(e) => setField("colorName", e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="color"
                    value={form.colorHex}
                    onChange={(e) => setField("colorHex", e.target.value)}
                    className="w-full sm:w-12 h-11 sm:h-10 rounded-lg border border-black/10 cursor-pointer shrink-0"
                  />
                </div>
              </div>
            </div>

            <ProductImagePicker
              value={form.imageUrl}
              onChange={(url) => setField("imageUrl", url)}
              disabled={saving}
            />

            <TagCheckboxes state={form} set={(patch) => setForm((f) => ({ ...f, ...patch }))} />
            {form.tagSale && (
              <p className="text-xs text-soul-muted">
                Price above is the original. Sale tag applies {saleDiscountPercent}% off (set on Dashboard).
              </p>
            )}

            <div>
              <label className="text-xs font-bold tracking-widest uppercase text-soul-muted block mb-1">
                Extra tags
              </label>
              <input
                value={form.customTags}
                onChange={(e) => setField("customTags", e.target.value)}
                placeholder="ribbed, zip (comma separated)"
                className={inputClass}
              />
            </div>

            <StockGrid
              stock={form.stock}
              bulkTarget="add"
              onChange={(size, val) =>
                setForm((f) => ({ ...f, stock: { ...f.stock, [size]: val } }))
              }
            />

            {error && !editingId && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="btn-soul--dark w-full sm:w-auto rounded-full px-8 py-3.5 sm:py-3 text-xs font-bold tracking-widest uppercase disabled:opacity-50 min-h-[48px]"
            >
              {saving ? "Saving…" : "Add product"}
            </button>
          </form>
        )}
      </GlassCard>

      <div>
        <h2 className="text-base sm:text-lg font-black tracking-tight mb-3">
          Catalog
          <span className="text-soul-muted font-semibold text-sm ml-2">{catalog.length}</span>
        </h2>

        <GlassCard className="p-3 sm:p-4 mb-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              value={catalogQ}
              onChange={(e) => {
                setCatalogQ(e.target.value);
                setPage(1);
              }}
              placeholder="Find by name or product code…"
              className={`${inputClass} flex-1`}
              autoComplete="off"
              spellCheck={false}
            />
            <select
              value={catalogCategory}
              onChange={(e) => {
                setCatalogCategory(e.target.value);
                setPage(1);
              }}
              className={`${inputClass} sm:w-48`}
              aria-label="Category filter"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-soul-muted">
            Showing {pageItems.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–
            {(safePage - 1) * PAGE_SIZE + pageItems.length} · page {safePage}/{totalPages}
          </p>
        </GlassCard>

        <div className="space-y-2">
          {pageItems.map((p) => {
            const variants = p.variants || [];
            const v = variants[0];
            const listOriginal = v ? v.price_cents : null;
            const onSale = p.tags?.includes("sale") ?? false;
            const listPreview =
              listOriginal != null && onSale
                ? salePreview(String(listOriginal), true, saleDiscountPercent)
                : null;
            const qty = productTotalStock(p);
            const isEditing = editingId === p.id && editForm;
            const uniqueTags = Array.from(new Set(p.tags || []));

            return (
              <GlassCard key={p.id} className="p-3 sm:p-4">
                {!isEditing ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-3 items-stretch sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-soul-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {p.product_code && (
                          <span className="font-mono font-semibold text-soul-ink">{p.product_code}</span>
                        )}
                        <span>
                          {variants.length} color{variants.length === 1 ? "" : "s"} · {qty} units
                        </span>
                        {listPreview ? (
                          <PriceDisplay
                            price={listPreview.sale}
                            compareAtPrice={listPreview.original}
                            onSale
                            discountPercent={saleDiscountPercent}
                            size="sm"
                          />
                        ) : listOriginal != null ? (
                          <span>{listOriginal.toLocaleString("en-US")} Ks</span>
                        ) : null}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {uniqueTags.includes("new") && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black text-white font-bold uppercase">
                            New
                          </span>
                        )}
                        {uniqueTags.includes("sale") && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-bold uppercase">
                            Sale
                          </span>
                        )}
                        {p.featured && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full glass font-bold uppercase">
                            Featured
                          </span>
                        )}
                        {uniqueTags
                          .filter((tag) => !["new", "sale"].includes(tag))
                          .map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-soul-muted"
                            >
                              {tag}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="flex-1 sm:flex-none text-xs font-bold tracking-widest uppercase px-4 py-2.5 rounded-full glass hover:shadow-card min-h-[44px]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProduct(p.id, p.name)}
                        className="flex-1 sm:flex-none text-xs font-bold tracking-widest uppercase px-4 py-2.5 rounded-full text-red-600 hover:bg-red-50 min-h-[44px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs font-bold tracking-widest uppercase text-soul-muted">Editing</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className={inputClass}
                        placeholder="Name"
                      />
                      <input
                        value={editForm.productCode}
                        onChange={(e) => setEditForm({ ...editForm, productCode: e.target.value })}
                        className={`${inputClass} font-mono`}
                        placeholder="Product code"
                        maxLength={32}
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      <input
                        value={editForm.price}
                        type="number"
                        min={0.01}
                        step={0.01}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        className={inputClass}
                        placeholder="Price"
                      />
                    </div>
                    <SalePriceHint
                      price={editForm.price}
                      onSale={editForm.tagSale}
                      saleDiscountPercent={saleDiscountPercent}
                    />
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className={inputClass}
                    />
                    <TagCheckboxes
                      state={editForm}
                      set={(patch) => setEditForm({ ...editForm, ...patch })}
                    />
                    <ProductImagePicker
                      value={editForm.imageUrl}
                      onChange={(url) => setEditForm({ ...editForm, imageUrl: url })}
                      disabled={saving}
                    />
                    <input
                      value={editForm.customTags}
                      onChange={(e) => setEditForm({ ...editForm, customTags: e.target.value })}
                      className={inputClass}
                      placeholder="Extra tags"
                    />
                    <StockGrid
                      stock={editForm.stock}
                      bulkTarget="edit"
                      onChange={(size, val) =>
                        setEditForm({ ...editForm, stock: { ...editForm.stock, [size]: val } })
                      }
                    />
                    {error && editingId === p.id && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={saving}
                        className="btn-soul--dark w-full sm:w-auto rounded-full px-6 py-3 text-xs font-bold tracking-widest uppercase min-h-[48px]"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditForm(null);
                          setError("");
                        }}
                        className="w-full sm:w-auto text-xs font-bold tracking-widest uppercase px-4 py-3 rounded-full glass min-h-[48px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}

          {pageItems.length === 0 && (
            <GlassCard className="p-8 text-center text-sm text-soul-muted">
              {catalogQ || catalogCategory
                ? "No products match these filters."
                : "No products yet. Open Add product above."}
            </GlassCard>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
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
    </div>
  );
}
