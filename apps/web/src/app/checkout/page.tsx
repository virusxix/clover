import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

/**
 * Checkout page
 * -------------
 * Thin route wrapper — form logic lives in CheckoutForm.
 */
export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-soul-muted">Loading checkout…</div>}>
      <CheckoutForm />
    </Suspense>
  );
}
