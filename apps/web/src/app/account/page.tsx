"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function AccountPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phone || "");
    }
  }, [user, loading, router]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    await api("/api/auth/profile", { method: "PATCH", json: { fullName, phone } });
    await refresh();
    setMsg("Profile updated");
  };

  const changePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    await api("/api/auth/password", {
      method: "PATCH",
      json: { currentPassword: fd.get("current"), newPassword: fd.get("new") },
    });
    setMsg("Password updated");
    form.reset();
  };

  if (loading || !user) return null;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-16">
      <h1 className="text-3xl font-black tracking-tight mb-8">My Account</h1>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          { href: "/account/orders", label: "Orders" },
          { href: "/account/wishlist", label: "Wishlist" },
          { href: "/cart", label: "Bag" },
        ].map((link) => (
          <Link key={link.href} href={link.href} className="card-soul p-4 text-center text-sm font-semibold hover:opacity-80">
            {link.label}
          </Link>
        ))}
      </div>

      {msg && <p className="text-green-700 text-sm mb-4">{msg}</p>}

      <GlassCard className="p-6 mb-6">
        <h2 className="font-bold text-sm tracking-widest uppercase mb-4">Profile</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-sm" />
          <input value={user.email} disabled className="w-full px-4 py-3 rounded-xl border border-black/10 bg-neutral-100 text-sm opacity-60" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-sm" />
          <button type="submit" className="btn-soul--dark rounded-full">Save Profile</button>
        </form>
      </GlassCard>

      <GlassCard className="p-6">
        <h2 className="font-bold text-sm tracking-widest uppercase mb-4">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-4">
          <input name="current" type="password" required placeholder="Current password" className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-sm" />
          <input name="new" type="password" required minLength={8} placeholder="New password" className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-sm" />
          <button type="submit" className="btn-soul--dark rounded-full">Update Password</button>
        </form>
      </GlassCard>
    </div>
  );
}
