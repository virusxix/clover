import { Suspense } from "react";
import LoginClient from "./LoginClient";

/**
 * Login route
 * -----------
 * Suspense wrapper so useSearchParams() is allowed in LoginClient.
 */
export default function LoginRoute() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-soul-muted">Loading…</div>}>
      <LoginClient />
    </Suspense>
  );
}
