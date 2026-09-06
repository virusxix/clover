"use client";

/**
 * Product detail page
 * -------------------
 * One job: load one product by slug and let the shopper pick color/size / add to bag.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { assetSrc } from "@/lib/media";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { CatalogError } from "@/components/ui/CatalogError";
import { PriceDisplay } from "@/components/shop/PriceDisplay";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";

type Variant = {
  id: string;
  key: string;
  colorName: string;
  colorHex: string;
  price: number;
  compareAtPrice?: number | null;
  onSale?: boolean;
  discountPercent?: number | null;
  stock: Record<string, number>;
  images: { url: string; alt: string }[];
};

type ProductDetail = {
  product: {
    id: string;
    slug: string;
    productCode?: string | null;
    name: string;
    description: string;
    specs: Record<string, string>;
  };
  variants: Variant[];
};

const SIZES = ["XS", "S", "M", "L", "XL"];

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const [data, setData] = useState<ProductDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [variantIdx, setVariantIdx] = useState(0);
  const [size, setSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoadingProduct(true);
    setLoadError(null);
    api<ProductDetail>(`/api/products/${slug}`)
      .then((d) => {
        setData(d);
        setLoadError(null);
      })
      .catch((err) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : "Product not found");
      })
      .finally(() => setLoadingProduct(false));
  }, [slug]);

  if (loadingProduct) {
    return <div className="p-10 sm:p-20 text-center text-soul-muted">Loading product…</div>;
  }

  if (loadError || !data) {
    return (
      <div className="max-w-lg mx-auto px-3 sm:px-6 py-12 sm:py-16">
        <CatalogError title="Product unavailable" message={loadError || "Product not found"} />
        <div className="text-center mt-6">
          <Link href="/shop" className="text-xs font-semibold tracking-widest uppercase hover:opacity-60">
            ← Back to shop
          </Link>
        </div>
      </div>
    );
  }

  const variant = data.variants[variantIdx];
  const images = variant?.images?.length ? variant.images : [{ url: "/assets/hero-image.png", alt: data.product.name }];
  const maxQty = Math.min(10, Math.max(0, variant?.stock?.[size] ?? 0));

  const addToCart = async () => {
    if (!user) {
      router.push(`/login?next=/product/${slug}`);
      return;
    }
    setLoading(true);
    try {
      const qty = Math.min(Math.max(1, quantity), maxQty);
      await api("/api/cart", {
        method: "POST",
        json: { variantId: variant.id, size, quantity: qty },
      });
      await refreshCart();
      setMsg(qty > 1 ? `Added ${qty} to bag!` : "Added to bag!");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = async () => {
    if (!user) return router.push(`/login?next=/product/${slug}`);
    await api(`/api/wishlist/${data.product.id}`, { method: "POST" });
    setMsg("Added to wishlist");
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-28 sm:pb-16">
      <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-16">
        <div className="space-y-3 sm:space-y-4">
          <div className="card-soul relative aspect-[3/4] overflow-hidden">
            <CatalogImage
              src={images[imgIdx]?.url || images[0].url}
              alt={data.product.name}
              fill
              priority
              quality={80}
              className="object-cover"
              sizes="(max-width:1024px) 100vw, 50vw"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-none pb-1">
              {images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setImgIdx(i)}
                  className={`relative w-14 h-[4.5rem] sm:w-16 sm:h-20 rounded-xl overflow-hidden border-2 shrink-0 touch-manipulation ${
                    imgIdx === i ? "border-black" : "border-transparent"
                  }`}
                >
                  <CatalogImage src={assetSrc(img.url)} alt="" fill quality={70} className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-xs tracking-widest uppercase text-soul-muted mb-2">THE CLOVER</p>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-1">{data.product.name}</h1>
          {data.product.productCode ? (
            <p className="font-mono text-sm text-soul-muted mb-4 tracking-wide">{data.product.productCode}</p>
          ) : (
            <div className="mb-4" />
          )}
          <div className="mb-6">
            <PriceDisplay
              price={variant.price}
              compareAtPrice={variant.compareAtPrice}
              onSale={variant.onSale}
              discountPercent={variant.discountPercent}
              size="lg"
              showBadge
            />
            {variant.onSale && variant.compareAtPrice != null && (
              <p className="text-sm text-soul-sale mt-2 font-medium">
                You save {formatMMK(variant.compareAtPrice - variant.price)} ({variant.discountPercent}% off)
              </p>
            )}
          </div>
          <p className="text-soul-muted leading-relaxed mb-8 text-sm sm:text-base">{data.product.description}</p>

          <div className="mb-6">
            <p className="text-xs font-bold tracking-widest uppercase mb-3">Color — {variant.colorName}</p>
            <div className="flex flex-wrap gap-2">
              {data.variants.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setVariantIdx(i);
                    setImgIdx(0);
                    setQuantity(1);
                  }}
                  className={`w-10 h-10 rounded-full border-2 transition-all touch-manipulation ${
                    variantIdx === i ? "border-black scale-110" : "border-black/10"
                  }`}
                  style={{ background: v.colorHex }}
                  title={v.colorName}
                />
              ))}
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs font-bold tracking-widest uppercase mb-3">Size</p>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => {
                const inStock = (variant.stock[s] ?? 0) > 0;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!inStock}
                    onClick={() => {
                      setSize(s);
                      setQuantity(1);
                    }}
                    className={`w-12 h-12 rounded-full text-sm font-medium border transition-all touch-manipulation ${
                      size === s
                        ? "bg-black text-white border-black"
                        : inStock
                          ? "border-black/10 hover:border-black/30"
                          : "opacity-30 line-through"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs font-bold tracking-widest uppercase mb-3">Quantity</p>
            <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 p-1">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-11 h-11 rounded-full text-lg font-bold touch-manipulation disabled:opacity-30 hover:bg-black/5"
              >
                −
              </button>
              <span className="min-w-[2.5rem] text-center text-base font-bold tabular-nums">{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={maxQty < 1 || quantity >= maxQty}
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                className="w-11 h-11 rounded-full text-lg font-bold touch-manipulation disabled:opacity-30 hover:bg-black/5"
              >
                +
              </button>
            </div>
            <p className="text-xs text-soul-muted mt-2">
              {maxQty > 0 ? `${maxQty} available in size ${size}` : `Size ${size} is out of stock`}
            </p>
          </div>

          <div className="hidden sm:flex flex-col sm:flex-row gap-3 mb-6">
            <button
              type="button"
              onClick={addToCart}
              disabled={loading || maxQty < 1}
              className="btn-soul--dark flex-1 rounded-full min-h-[48px]"
            >
              {loading ? "Adding…" : quantity > 1 ? `Add ${quantity} to Bag` : "Add to Bag"}
            </button>
            <button type="button" onClick={toggleWishlist} className="btn-soul--glass flex-1 rounded-full min-h-[48px]">
              ♥ Wishlist
            </button>
          </div>

          {msg && <p className="text-sm text-green-700 mb-4">{msg}</p>}

          <GlassCard className="p-5 sm:p-6 mt-4 sm:mt-8">
            <p className="text-xs font-bold tracking-widest uppercase mb-4">Specifications</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {Object.entries(data.product.specs || {}).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-soul-muted capitalize">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </GlassCard>

          <Link
            href="/shop"
            className="inline-flex items-center mt-6 text-xs font-semibold tracking-widest uppercase hover:opacity-60 min-h-[44px]"
          >
            ← Back to shop
          </Link>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-black/5 px-3 py-3 safe-bottom">
        <div className="flex gap-2 max-w-7xl mx-auto">
          <button
            type="button"
            onClick={toggleWishlist}
            className="btn-soul--glass rounded-full min-h-[48px] min-w-[48px] px-4"
            aria-label="Add to wishlist"
          >
            ♥
          </button>
          <button
            type="button"
            onClick={addToCart}
            disabled={loading || maxQty < 1}
            className="btn-soul--dark flex-1 rounded-full min-h-[48px]"
          >
            {loading ? "Adding…" : quantity > 1 ? `Add ${quantity} to Bag` : "Add to Bag"}
          </button>
        </div>
      </div>
    </div>
  );
}
