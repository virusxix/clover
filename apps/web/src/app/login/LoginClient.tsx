"use client";

/**
 * Customer login / register — shoppers only.
 */

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { useAuth } from "@/lib/auth-context";
import { homePathForRole, isCustomer } from "@/lib/roles";

/** Only allow same-origin relative paths for ?next= redirects. */
function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  // Never bounce customers into staff portals via ?next=
  if (raw === "/admin" || raw.startsWith("/admin/") || raw === "/reception" || raw.startsWith("/reception/")) {
    return "/account";
  }
  return raw;
}

function resolvePostLoginPath(role: string | undefined, nextPath: string | null) {
  if (role !== "customer") {
    if (role === "admin") return "/admin";
    if (role === "reception") return "/reception";
  }
  return nextPath || homePathForRole(role);
}

async function wakeApi() {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch("/api/health", { credentials: "include", cache: "no-store" });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

export default function LoginClient() {
  const { login, register, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiReady, setApiReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    wakeApi().then((ok) => {
      if (!cancelled) setApiReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (user) {
    router.replace(resolvePostLoginPath(user.role, nextPath));
    return null;
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      if (apiReady === false) {
        setError("Connecting to server… one moment");
        await wakeApi();
      }
      if (mode === "login") {
        const loggedIn = await login(
          String(fd.get("email")),
          String(fd.get("password")),
          "customer"
        );
        if (!isCustomer(loggedIn.role)) {
          setError("Customer accounts only on this page.");
          return;
        }
        router.push(resolvePostLoginPath(loggedIn.role, nextPath));
      } else {
        await register(
          String(fd.get("email")),
          String(fd.get("password")),
          String(fd.get("fullName"))
        );
        router.push(nextPath || "/account");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (/USE_ADMIN_LOGIN|Owners must/i.test(msg)) {
        setError("Owners: use the Admin login at /admin/login");
      } else if (/USE_RECEPTION_LOGIN|Reception staff must/i.test(msg)) {
        setError("Reception staff: use /reception/login");
      } else {
        setError(
          /reach|503|502|504|network|waking|timeout/i.test(msg)
            ? `${msg} — on slow networks wait 30–60s and try Sign In again.`
            : msg
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-3 sm:px-4 py-10 sm:py-16 pb-16">
      <GlassCard className="p-5 sm:p-8">
        <div className="flex justify-center mb-6">
          <BrandLogo href="/" size="sm" wordmarkClassName="" />
        </div>
        <h1 className="text-2xl font-black tracking-tight mb-2 text-center">
          {mode === "login" ? "Customer sign in" : "Create account"}
        </h1>
        <p className="text-sm text-soul-muted mb-6 text-center">
          {mode === "login"
            ? "Shop, bag, and track your orders."
            : "Join THE CLOVER to shop and track orders."}
        </p>

        {apiReady === false && (
          <p className="text-[11px] text-amber-800 mb-4 text-center rounded-lg bg-amber-50 border border-amber-200/80 px-3 py-2">
            Server is waking up — first sign-in can take up to a minute on some networks. Keep trying.
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <input
              name="fullName"
              required
              placeholder="Full name"
              autoComplete="name"
              className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-base min-h-[48px]"
            />
          )}
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-base min-h-[48px]"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-base min-h-[48px]"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-soul--dark w-full rounded-full min-h-[48px]"
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Register"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 w-full text-sm text-soul-muted hover:text-black min-h-[44px]"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>

        <p className="mt-6 text-center text-xs text-soul-muted space-y-2">
          <Link href="/" className="hover:text-black block">
            ← Back to shop
          </Link>
          <Link href="/admin/login" className="hover:text-black block">
            Owner admin login
          </Link>
          <Link href="/reception/login" className="hover:text-black block">
            Reception / floor login
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
