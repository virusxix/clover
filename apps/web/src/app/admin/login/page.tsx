"use client";

/**
 * Owner admin login — admins only (no register, no shop).
 */

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { useAuth } from "@/lib/auth-context";
import { isAdmin, isReception } from "@/lib/roles";

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

export default function AdminLoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
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

  useEffect(() => {
    if (authLoading) return;
    if (user && isAdmin(user.role)) {
      router.replace("/admin");
      return;
    }
    if (user && isReception(user.role)) {
      router.replace("/reception");
    }
  }, [user, authLoading, router]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      if (apiReady === false) {
        setError("Connecting to server… one moment");
        await wakeApi();
      }
      const loggedIn = await login(String(fd.get("email")), String(fd.get("password")), "admin");
      if (!isAdmin(loggedIn.role)) {
        setError("Admin access only");
        return;
      }
      router.replace("/admin");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setError(
        /reach|503|502|504|network|waking|timeout/i.test(msg)
          ? `${msg} — wait 30–60s and try again.`
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || (user && (isAdmin(user.role) || isReception(user.role)))) {
    return null;
  }

  return (
    <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-12 sm:py-16">
      <GlassCard className="p-5 sm:p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <BrandLogo href="/admin/login" size="sm" wordmarkClassName="" />
        </div>
        <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted text-center mb-2">
          Owner console
        </p>
        <h1 className="text-2xl font-black tracking-tight mb-2 text-center">Admin sign in</h1>
        <p className="text-sm text-soul-muted mb-6 text-center">
          Profit, catalog, users, and analytics. Floor ops (POS, orders) use Reception.
        </p>

        {apiReady === false && (
          <p className="text-[11px] text-amber-800 mb-4 text-center rounded-lg bg-amber-50 border border-amber-200/80 px-3 py-2">
            Server is waking up — first sign-in can take up to a minute.
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          <input
            name="email"
            type="email"
            required
            placeholder="Owner email"
            autoComplete="username"
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-base min-h-[48px]"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-base min-h-[48px]"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-soul--dark w-full rounded-full min-h-[48px]"
          >
            {loading ? "Please wait…" : "Sign in to admin"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-soul-muted space-y-2">
          <Link href="/login" className="hover:text-black block">
            Customer login
          </Link>
          <Link href="/reception/login" className="hover:text-black block">
            Reception / floor login
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
