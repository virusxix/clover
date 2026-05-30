"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login, register, user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    router.replace(user.role === "admin" ? "/admin" : "/account");
    return null;
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      if (mode === "login") {
        const loggedIn = await login(String(fd.get("email")), String(fd.get("password")));
        router.push(loggedIn.role === "admin" ? "/admin" : "/account");
      } else {
        await register(String(fd.get("email")), String(fd.get("password")), String(fd.get("fullName")));
        router.push("/account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
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
        <h1 className="text-2xl font-black tracking-tight mb-2 text-center">{mode === "login" ? "Sign In" : "Create Account"}</h1>
        <p className="text-sm text-soul-muted mb-6 text-center">
          Admin: <strong>admin@clover.com</strong> / <strong>Admin123!</strong>
          <br />
          Demo: demo@clover.com / Demo1234!
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <input name="fullName" required placeholder="Full name" className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-sm" />
          )}
          <input name="email" type="email" required placeholder="Email" className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-sm" />
          <input name="password" type="password" required minLength={8} placeholder="Password" className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-sm" />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-soul--dark w-full rounded-full">
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Register"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 text-xs text-soul-muted hover:text-black w-full text-center"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </GlassCard>

      <p className="text-center mt-6">
        <Link href="/" className="text-xs tracking-widest uppercase hover:opacity-60">← Back to store</Link>
      </p>
    </div>
  );
}
