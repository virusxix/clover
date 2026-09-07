"use client";

/**
 * Floor portal top bar — no shop navigation.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { useAuth } from "@/lib/auth-context";
import { isReception } from "@/lib/roles";

export function ReceptionChrome({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname() || "";
  const isLogin = pathname === "/reception/login";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--soul-bg,#f4f4f5)]">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo href={isLogin ? "/reception/login" : "/reception"} size="nav" className="shrink-0" />
            <div className="min-w-0 hidden sm:block">
              <p className="text-[10px] font-bold tracking-widest uppercase text-soul-muted">
                Floor portal
              </p>
              <p className="text-sm font-semibold truncate">THE CLOVER · Reception</p>
            </div>
          </div>
          {!loading && user && !isLogin && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-soul-muted hidden md:inline truncate max-w-[10rem]">
                {user.fullName}
                {isReception(user.role) ? " · reception" : user.role === "admin" ? " · admin" : ""}
              </span>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-[10px] font-bold tracking-widest uppercase px-3 py-2 rounded-full border border-black/10 min-h-[40px] inline-flex items-center"
                >
                  Owner admin
                </Link>
              )}
              <button
                type="button"
                onClick={() => void logout().then(() => {
                  window.location.href = "/reception/login";
                })}
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
