"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

function ConfirmationContent() {
  const params = useSearchParams();
  const orderId = params.get("id");

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <GlassCard className="p-10">
        <p className="text-4xl mb-4">✓</p>
        <h1 className="text-2xl font-black mb-2">Order Confirmed</h1>
        <p className="text-soul-muted text-sm mb-6">
          Thank you for your purchase. Your order {orderId ? `#${orderId.slice(0, 8)}` : ""} is being processed.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/account/orders" className="btn-soul--dark rounded-full">View Orders</Link>
          <Link href="/shop" className="btn-soul--glass rounded-full">Continue Shopping</Link>
        </div>
      </GlassCard>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense>
      <ConfirmationContent />
    </Suspense>
  );
}
