"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { CatalogImage } from "@/components/ui/CatalogImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { PriceDisplay } from "@/components/shop/PriceDisplay";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  US_STATES,
  cardBrandHint,
  computeOrderTotals,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
} from "@/lib/checkout";
import { formatMMK } from "@/lib/currency";

type CartItem = {
  id: string;
  quantity: number;
  size: string;
  slug: string;
  name: string;
  colorName: string;
  price: number;
  compareAtPrice?: number | null;
  onSale?: boolean;
  imageUrl?: string;
  lineTotal: number;
};

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-black/10 bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-black/15 min-h-[48px]";

function Field({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold tracking-wide text-soul-muted mb-1.5">
        {label}
        {required && <span className="text-soul-sale ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function CheckoutSteps({ current }: { current: 2 | 3 }) {
  const steps = [
    { n: 1, label: "Bag", href: "/cart" },
    { n: 2, label: "Checkout", href: "/checkout" },
    { n: 3, label: "Confirmation", href: null },
  ];
  return (
    <nav className="flex items-center gap-2 sm:gap-3 text-xs font-semibold tracking-wide mb-8" aria-label="Checkout progress">
      {steps.map((s, i) => (
        <span key={s.n} className="flex items-center gap-2 sm:gap-3">
          {i > 0 && <span className="text-soul-muted/40">/</span>}
          {s.href && s.n < current ? (
            <Link href={s.href} className="text-soul-muted hover:text-black transition-colors">
              {s.label}
            </Link>
          ) : (
            <span className={s.n === current ? "text-black" : "text-soul-muted"}>{s.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [cartLoading, setCartLoading] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/28");
  const [cvc, setCvc] = useState("123");

  const totals = useMemo(() => computeOrderTotals(subtotal), [subtotal]);
  const brand = cardBrandHint(cardNumber);
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login?next=/checkout");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setCartLoading(true);
    api<{ items: CartItem[]; subtotal: number }>("/api/cart")
      .then((d) => {
        setItems(d.items);
        setSubtotal(d.subtotal);
      })
      .catch(() => {
        setItems([]);
        setSubtotal(0);
      })
      .finally(() => setCartLoading(false));
  }, [user]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!items.length) return;
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const card = digitsOnly(cardNumber, 16);

    if (card.length !== 16) {
      setError("Enter a valid 16-digit card number.");
      setLoading(false);
      return;
    }

    try {
      const res = await api<{ orderId: string }>("/api/orders/checkout", {
        method: "POST",
        json: {
          shipping: {
            name: fd.get("name"),
            line1: fd.get("line1"),
            line2: fd.get("line2") || undefined,
            city: fd.get("city"),
            state: fd.get("state"),
            zip: fd.get("zip"),
            country: "US",
          },
          payment: {
            cardNumber: card,
            expiry: fd.get("expiry"),
            cvc: fd.get("cvc"),
          },
        },
      });
      router.push(`/order-confirmation?id=${res.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) return null;

  if (cartLoading) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-10 text-center text-soul-muted">
        Loading checkout…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-3 sm:px-6 py-16 text-center">
        <GlassCard className="p-10">
          <h1 className="text-xl font-black mb-2">Your bag is empty</h1>
          <p className="text-sm text-soul-muted mb-6">Add items before checking out.</p>
          <Link href="/shop" className="btn-soul--dark rounded-full inline-flex">
            Continue shopping
          </Link>
        </GlassCard>
      </div>
    );
  }

  const orderSummary = (
    <GlassCard className="p-5 sm:p-6 lg:sticky lg:top-28">
      <h2 className="font-bold text-sm tracking-widest uppercase mb-4">
        Order summary <span className="text-soul-muted font-normal">({itemCount})</span>
      </h2>

      <ul className="space-y-4 max-h-[280px] overflow-y-auto pr-1 scrollbar-none mb-5">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <div className="relative w-14 h-[4.5rem] rounded-lg overflow-hidden shrink-0 bg-neutral-100">
              <CatalogImage
                src={item.imageUrl}
                alt={item.name}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-semibold line-clamp-2 leading-snug">{item.name}</p>
              <p className="text-soul-muted text-xs mt-0.5">
                {item.colorName} · {item.size} · Qty {item.quantity}
              </p>
              <div className="mt-1 flex justify-between items-end gap-2">
                <PriceDisplay
                  price={item.price}
                  compareAtPrice={item.compareAtPrice}
                  onSale={item.onSale}
                  size="sm"
                />
                <span className="font-bold shrink-0">{formatMMK(item.lineTotal)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-2 text-sm border-t border-black/5 pt-4">
        <div className="flex justify-between">
          <span className="text-soul-muted">Subtotal</span>
          <span>{formatMMK(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-soul-muted">Shipping</span>
          <span>
            {totals.freeShipping ? (
              <span className="text-green-700 font-medium">Free</span>
            ) : (
              formatMMK(totals.shipping)
            )}
          </span>
        </div>
        {!totals.freeShipping && totals.amountUntilFreeShipping > 0 && (
          <p className="text-[11px] text-soul-muted">
            Add {formatMMK(totals.amountUntilFreeShipping)} more for free shipping
          </p>
        )}
        <div className="flex justify-between">
          <span className="text-soul-muted">Estimated tax</span>
          <span>{formatMMK(totals.tax)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-black/5 text-base font-black">
          <span>Total</span>
          <span>{formatMMK(totals.total)}</span>
        </div>
        <p className="text-[10px] text-soul-muted pt-1">MMK · Tax calculated at checkout</p>
      </div>

      <button
        type="submit"
        form="checkout-form"
        disabled={loading}
        className="btn-soul--dark w-full rounded-full mt-6 min-h-[52px] hidden lg:flex items-center justify-center"
      >
        {loading ? "Processing…" : `Pay ${formatMMK(totals.total)}`}
      </button>
    </GlassCard>
  );

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-24 lg:pb-16">
      <CheckoutSteps current={2} />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Checkout</h1>
          <p className="text-sm text-soul-muted mt-1">Secure checkout · THE CLOVER</p>
        </div>
        <Link href="/cart" className="text-xs font-semibold tracking-widest uppercase hover:opacity-60">
          ← Edit bag
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-10 lg:items-start">
        <form id="checkout-form" onSubmit={submit} className="space-y-6 min-w-0">
          {/* Mobile order summary */}
          <div className="lg:hidden">{orderSummary}</div>

          <GlassCard className="p-5 sm:p-6 space-y-4">
            <h2 className="font-bold text-sm tracking-widest uppercase">Contact</h2>
            <Field label="Email" id="contact-email" required>
              <input
                id="contact-email"
                type="email"
                readOnly
                value={user.email}
                className={`${inputClass} bg-neutral-50 text-soul-muted cursor-default`}
              />
            </Field>
            <p className="text-xs text-soul-muted">Order updates will be sent to this address.</p>
          </GlassCard>

          <GlassCard className="p-5 sm:p-6 space-y-4">
            <h2 className="font-bold text-sm tracking-widest uppercase">Delivery</h2>
            <div className="rounded-xl border-2 border-black bg-black/5 p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold text-sm">Standard shipping</p>
                <p className="text-xs text-soul-muted mt-0.5">5–7 business days</p>
              </div>
              <p className="font-bold text-sm">
                {totals.freeShipping ? "Free" : formatMMK(totals.shipping)}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <Field label="Full name" id="name" required>
                <input
                  id="name"
                  name="name"
                  required
                  defaultValue={user.fullName}
                  autoComplete="name"
                  className={inputClass}
                />
              </Field>
              <Field label="Phone (optional)" id="phone">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="(555) 000-0000"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Address" id="line1" required>
              <input id="line1" name="line1" required autoComplete="address-line1" className={inputClass} />
            </Field>
            <Field label="Apartment, suite, etc." id="line2">
              <input id="line2" name="line2" autoComplete="address-line2" className={inputClass} />
            </Field>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="City" id="city" required>
                <input id="city" name="city" required autoComplete="address-level2" className={inputClass} />
              </Field>
              <Field label="State" id="state" required>
                <select id="state" name="state" required autoComplete="address-level1" className={inputClass}>
                  <option value="">Select</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ZIP code" id="zip" required>
                <input
                  id="zip"
                  name="zip"
                  required
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={10}
                  className={inputClass}
                />
              </Field>
            </div>
            <input type="hidden" name="country" value="US" />
            <p className="text-xs text-soul-muted">United States only</p>
          </GlassCard>

          <GlassCard className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-sm tracking-widest uppercase">Payment</h2>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-soul-muted uppercase tracking-wider">
                <span className="px-1.5 py-0.5 rounded border border-black/10 bg-white/80">Visa</span>
                <span className="px-1.5 py-0.5 rounded border border-black/10 bg-white/80">MC</span>
                <span className="px-1.5 py-0.5 rounded border border-black/10 bg-white/80">Amex</span>
              </div>
            </div>

            <p className="text-xs text-soul-muted rounded-lg bg-neutral-100/80 px-3 py-2">
              Demo checkout — no real charges. Test card: 4242 4242 4242 4242 · Any future expiry · CVC 123
            </p>

            <Field label="Card number" id="card" required>
              <div className="relative">
                <input
                  id="card"
                  name="card"
                  required
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className={`${inputClass} pr-16 font-mono tracking-wider`}
                  placeholder="1234 5678 9012 3456"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-soul-muted">
                  {brand === "unknown" ? "Card" : brand}
                </span>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Expiry" id="expiry" required>
                <input
                  id="expiry"
                  name="expiry"
                  required
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  maxLength={5}
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="Security code" id="cvc" required>
                <input
                  id="cvc"
                  name="cvc"
                  required
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={cvc}
                  onChange={(e) => setCvc(digitsOnly(e.target.value, 4))}
                  placeholder="CVC"
                  maxLength={4}
                  className={`${inputClass} font-mono`}
                />
              </Field>
            </div>

            <Field label="Name on card" id="cardName" required>
              <input
                id="cardName"
                name="cardName"
                required
                defaultValue={user.fullName}
                autoComplete="cc-name"
                className={inputClass}
              />
            </Field>
          </GlassCard>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-soul-muted">
            <span aria-hidden>🔒</span>
            <span>256-bit SSL encryption · Your payment info is not stored</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-soul--dark w-full rounded-full min-h-[52px] lg:hidden"
          >
            {loading ? "Processing…" : `Pay ${formatMMK(totals.total)}`}
          </button>
        </form>

        <aside className="hidden lg:block">{orderSummary}</aside>
      </div>
    </div>
  );
}
