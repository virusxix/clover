import { Suspense } from "react";
import { ShopContent } from "./ShopContent";

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-soul-muted">Loading shop…</div>}>
      <ShopContent />
    </Suspense>
  );
}
