"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { assetSrc } from "@/lib/media";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { PriceDisplay } from "@/components/shop/PriceDisplay";
import { api } from "@/lib/api";
import { formatMMK } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";

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
  const [data, setData] = useState<ProductDetail | null>(null);
  const [variantIdx, setVariantIdx] = useState(0);
  const [size, setSize] = useState("M");
  const [imgIdx, setImgIdx] = useState(0);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<ProductDetail>(`/api/products/${slug}`).then(setData).catch(() => setData(null));
  }, [slug]);

  if (!data) {
    return <div className="p-20 text-center text-soul-muted">Loading product…</div>;
  }

  const variant = data.variants[variantIdx];
  const images = variant?.images?.length ? variant.images : [{ url: "/assets/hero-image.png", alt: data.product.name }];

  const addToCart = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      await api("/api/cart", { method: "POST", json: { variantId: variant.id, size, quantity: 1 } });
      setMsg("Added to bag!");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = async () => {
    if (!user) return router.push("/login");
    await api(`/api/wishlist/${data.product.id}`, { method: "POST" });
    setMsg("Added to wishlist");
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-16">
      <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-16">
        <div className="space-y-4">
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
            <div className="flex gap-3">
              {images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setImgIdx(i)}
                  className={`relative w-16 h-20 rounded-xl overflow-hidden border-2 ${imgIdx === i ? "border-black" : "border-transparent"}`}
                >
                  <CatalogImage src={assetSrc(img.url)} alt="" fill quality={70} className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs tracking-widest uppercase text-soul-muted mb-2">THE CLOVER</p>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-4">{data.product.name}</h1>
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
          <p className="text-soul-muted leading-relaxed mb-8">{data.product.description}</p>

          <div className="mb-6">
            <p className="text-xs font-bold tracking-widest uppercase mb-3">Color — {variant.colorName}</p>
            <div className="flex flex-wrap gap-2">
              {data.variants.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setVariantIdx(i); setImgIdx(0); }}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${variantIdx === i ? "border-black scale-110" : "border-black/10"}`}
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
                    onClick={() => setSize(s)}
                    className={`w-12 h-12 rounded-full text-sm font-medium border transition-all ${
                      size === s ? "bg-black text-white border-black" : inStock ? "border-black/10 hover:border-black/30" : "opacity-30 line-through"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button type="button" onClick={addToCart} disabled={loading} className="btn-soul--dark flex-1 rounded-full">
              {loading ? "Adding…" : "Add to Bag"}
            </button>
            <button type="button" onClick={toggleWishlist} className="btn-soul--glass flex-1 rounded-full">
              ♥ Wishlist
            </button>
          </div>

          {msg && <p className="text-sm text-green-700 mb-4">{msg}</p>}

          <GlassCard className="p-6 mt-8">
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

          <Link href="/shop" className="inline-block mt-6 text-xs font-semibold tracking-widest uppercase hover:opacity-60">
            ← Back to shop
          </Link>
        </div>
      </div>
    </div>
  );
}
