"use client";

/**
 * Checkout form
 * -------------
 * One job: collect shipping + payment, place order, redirect to confirmation.
 * Order summary UI lives in OrderSummaryCard.
 */

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
import {
  CheckoutCartItem,
  OrderSummaryCard,
} from "@/components/checkout/OrderSummaryCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { MM_REGIONS, computeOrderTotals } from "@/lib/checkout";
import { formatMMK } from "@/lib/currency";
import {
  WEB_PAYMENT_METHODS,
  isMandalayArea,
  type WebPaymentMethod,
} from "@/lib/payments";

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-black/10 bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-black/15 min-h-[48px]";

export function CheckoutForm() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<CheckoutCartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<WebPaymentMethod>("kbzpay");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");

  const totals = useMemo(() => computeOrderTotals(subtotal), [subtotal]);
  const codOk = isMandalayArea(city, stateRegion);

  useEffect(() => {
    if (paymentMethod === "cod" && !codOk) setPaymentMethod("kbzpay");
  }, [paymentMethod, codOk]);

  // Guests must sign in before checkout.
  useEffect(() => {
    if (!authLoading && !user) router.push("/login?next=/checkout");
  }, [user, authLoading, router]);

  // Load bag once we know who the user is.
  useEffect(() => {
    if (!user) return;
    setCartLoading(true);
    setCartError("");

    api<{ items: CheckoutCartItem[]; subtotal: number }>("/api/cart")
      .then((data) => {
        setItems(data.items);
        setSubtotal(data.subtotal);
      })
      .catch((err) => {
        setItems([]);
        setSubtotal(0);
        setCartError(err instanceof Error ? err.message : "Failed to load cart");
      })
      .finally(() => setCartLoading(false));
  }, [user]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!items.length) return;

    if (paymentMethod === "cod" && !codOk) {
      setError("Cash on delivery is only available for Mandalay area addresses.");
      return;
    }

    setSubmitting(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    try {
      const res = await api<{ orderId: string }>("/api/orders/checkout", {
        method: "POST",
        json: {
          shipping: {
            name: fd.get("name"),
            phone: String(fd.get("phone") || "").trim() || undefined,
            line1: fd.get("line1"),
            line2: fd.get("line2") || undefined,
            city: fd.get("city"),
            state: fd.get("state"),
            zip: fd.get("zip"),
            country: "MM",
          },
          payment: { method: paymentMethod },
        },
      });
      router.push(`/order-confirmation?id=${res.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <Status message="Checking your session…" />;
  }
  if (cartLoading) {
    return <Status message="Loading checkout…" />;
  }
  if (cartError) {
    return (
      <EmptyState
        title="Couldn’t load bag"
        body={cartError}
        href="/cart"
        cta="Back to bag"
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Your bag is empty"
        body="Add items before checking out."
        href="/shop"
        cta="Continue shopping"
      />
    );
  }

  const summary = (
    <OrderSummaryCard items={items} totals={totals} loading={submitting} showSubmit />
  );

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-28 lg:pb-16">
      <CheckoutSteps current={2} />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Checkout</h1>
          <p className="text-sm text-soul-muted mt-1">Delivery across Myanmar · THE CLOVER</p>
        </div>
        <Link
          href="/cart"
          className="text-xs font-semibold tracking-widest uppercase hover:opacity-60 min-h-[44px] inline-flex items-center"
        >
          ← Edit bag
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-10 lg:items-start">
        <form id="checkout-form" onSubmit={onSubmit} className="space-y-6 min-w-0">
          <div className="lg:hidden">{summary}</div>

          <GlassCard className="p-5 sm:p-6 space-y-4">
            <SectionTitle>Contact</SectionTitle>
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
            <SectionTitle>Delivery</SectionTitle>
            <div className="rounded-xl border-2 border-black bg-black/5 p-4 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm">Standard shipping</p>
                <p className="text-xs text-soul-muted mt-0.5">5–7 business days · Myanmar</p>
              </div>
              <p className="font-bold text-sm shrink-0">
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
              <Field label="Phone" id="phone" required>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="09…"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Address" id="line1" required>
              <input id="line1" name="line1" required autoComplete="address-line1" className={inputClass} />
            </Field>
            <Field label="Township / landmark" id="line2">
              <input id="line2" name="line2" autoComplete="address-line2" className={inputClass} />
            </Field>

            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="City" id="city" required>
                <input
                  id="city"
                  name="city"
                  required
                  autoComplete="address-level2"
                  className={inputClass}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </Field>
              <Field label="State / Region" id="state" required>
                <input
                  id="state"
                  name="state"
                  required
                  list="mm-regions"
                  autoComplete="address-level1"
                  placeholder="Mandalay"
                  className={inputClass}
                  value={stateRegion}
                  onChange={(e) => setStateRegion(e.target.value)}
                />
                <datalist id="mm-regions">
                  {MM_REGIONS.map((region) => (
                    <option key={region} value={region} />
                  ))}
                </datalist>
              </Field>
              <Field label="Postal code" id="zip" required>
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
            <input type="hidden" name="country" value="MM" />
            <p className="text-xs text-soul-muted">Deliveries within Myanmar</p>
          </GlassCard>

          <GlassCard className="p-5 sm:p-6 space-y-4">
            <SectionTitle>Payment</SectionTitle>
            <div className="space-y-2">
              {WEB_PAYMENT_METHODS.map((m) => {
                const disabled = m.id === "cod" && !codOk;
                return (
                  <label
                    key={m.id}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
                      paymentMethod === m.id
                        ? "border-black bg-black/5"
                        : "border-black/10 bg-white/60"
                    } ${disabled ? "opacity-45 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      className="mt-1"
                      checked={paymentMethod === m.id}
                      disabled={disabled}
                      onChange={() => setPaymentMethod(m.id)}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-sm">{m.label}</span>
                      {"hint" in m && m.hint && (
                        <span className="block text-xs text-soul-muted mt-0.5">{m.hint}</span>
                      )}
                      {m.id === "cod" && !codOk && (
                        <span className="block text-xs text-amber-800 mt-0.5">
                          Enter a Mandalay city/region to enable COD.
                        </span>
                      )}
                      {m.id === "kbzpay" && (
                        <span className="block text-xs text-soul-muted mt-0.5">
                          Pay via KBZPay after placing the order — our team will confirm.
                        </span>
                      )}
                      {m.id === "card" && (
                        <span className="block text-xs text-soul-muted mt-0.5">
                          Card payment arranged with our team after the order is placed.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </GlassCard>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-soul--dark w-full rounded-full min-h-[52px] lg:hidden safe-bottom"
          >
            {submitting ? "Processing…" : `Place order · ${formatMMK(totals.total)}`}
          </button>
        </form>

        <aside className="hidden lg:block">{summary}</aside>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-bold text-sm tracking-widest uppercase">{children}</h2>;
}

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

function Status({ message }: { message: string }) {
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-10 text-center text-soul-muted">
      {message}
    </div>
  );
}

function EmptyState({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="max-w-lg mx-auto px-3 sm:px-6 py-16 text-center">
      <GlassCard className="p-8 sm:p-10">
        <h1 className="text-xl font-black mb-2">{title}</h1>
        <p className="text-sm text-soul-muted mb-6">{body}</p>
        <Link href={href} className="btn-soul--dark rounded-full inline-flex min-h-[44px]">
          {cta}
        </Link>
      </GlassCard>
    </div>
  );
}
