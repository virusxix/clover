"use client";

/**
 * Owner admin chrome — no shop navigation.
 * Reception and customers are bounced; only admin may use /admin.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { useAuth } from "@/lib/auth-context";
import { isAdmin, isReception } from "@/lib/roles";

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname() || "";
  const router = useRouter();
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (loading || isLogin) return;
    if (!user) {
      router.replace("/admin/login");
      return;
    }
    if (!isAdmin(user.role)) {
      router.replace(isReception(user.role) ? "/reception" : "/login");
    }
  }, [user, loading, isLogin, router]);

  useEffect(() => {
    if (loading || !isLogin || !user) return;
    if (isAdmin(user.role)) {
      router.replace("/admin");
      return;
    }
    if (isReception(user.role)) {
      router.replace("/reception");
      return;
    }
    router.replace("/login");
  }, [user, loading, isLogin, router]);

  if (!isLogin && (loading || !user || !isAdmin(user.role))) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--soul-bg,#f4f4f5)]">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo href={isLogin ? "/admin/login" : "/admin"} size="nav" className="shrink-0" />
            <div className="min-w-0 hidden sm:block">
              <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted">
                Owner console
              </p>
              <p className="text-sm font-semibold truncate">THE CLOVER · Admin</p>
            </div>
          </div>
          {!loading && user && !isLogin && isAdmin(user.role) && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-soul-muted hidden md:inline truncate max-w-[10rem]">
                {user.fullName}
              </span>
              <button
                type="button"
                onClick={() =>
                  void logout().then(() => {
                    window.location.href = "/admin/login";
                  })
                }
                className="text-[10px] font-bold tracking-widest uppercase px-3 py-2 rounded-full bg-black text-white min-h-[40px]"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="flex-1 w-full min-w-0">{children}</div>
    </div>
  );
}
