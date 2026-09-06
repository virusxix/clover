"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { BrandLogo } from "@/components/layout/BrandLogo";

const MAIN_NAV = [
  { href: "/", label: "Home" },
  { href: "/new-in", label: "New In" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About Me" },
  { href: "/shop?sale=true", label: "Sale", sale: true },
];

export function Header() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const isAdmin = user?.role === "admin";
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 pt-2 sm:pt-4 px-2 sm:px-5 lg:px-8 pointer-events-none safe-top">
        <nav className="nav-float max-w-7xl mx-auto px-2.5 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 pointer-events-auto isolate">
          <BrandLogo size="nav" href="/" className="shrink-0 min-w-0" />

          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center min-w-0">
            {MAIN_NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`nav-link-pill uppercase tracking-[0.1em] ${
                  item.sale ? "text-soul-sale hover:bg-red-50" : "text-[var(--soul-text)]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {user ? (
              <>
                <Link href="/account" className="nav-link-pill hidden md:inline-flex max-w-[5rem] truncate">
                  {user.fullName.split(" ")[0]}
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="nav-link-pill hidden md:inline-flex">
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => logout()}
                  className="nav-link-pill text-soul-muted hidden md:inline-flex"
                >
                  Out
                </button>
              </>
            ) : (
              <Link href="/login" className="nav-link-pill hidden sm:inline-flex">
                Account
              </Link>
            )}
            <Link href="/account/wishlist" className="nav-link-pill min-w-[2.25rem] justify-center" aria-label="Wishlist">
              ♥
            </Link>
            <Link
              href="/cart"
              className="nav-link-pill relative min-w-[2.5rem] justify-center px-2.5 sm:px-3.5"
              aria-label={itemCount > 0 ? `Shopping bag, ${itemCount} items` : "Shopping bag"}
            >
              <span className="hidden sm:inline">Bag</span>
              <span className="sm:hidden text-xs font-bold">Bag</span>
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 sm:right-0 min-w-[1.1rem] h-[1.1rem] px-1 bg-black text-white text-[9px] rounded-full flex items-center justify-center font-bold tabular-nums">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              className="lg:hidden nav-link-pill min-w-[2.5rem] justify-center text-base"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </nav>
      </header>

      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={`absolute left-2 right-2 sm:left-4 sm:right-4 top-[calc(var(--nav-spacer)-0.25rem)] max-h-[min(75vh,560px)] overflow-y-auto rounded-2xl glass shadow-card transition-all duration-300 ${
            menuOpen ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
          }`}
        >
          <nav className="p-3 sm:p-4 flex flex-col gap-0.5">
            {MAIN_NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`px-4 py-3.5 rounded-xl text-sm font-semibold tracking-wide min-h-[44px] flex items-center ${
                  item.sale ? "text-soul-sale hover:bg-red-50" : "hover:bg-black/5"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <hr className="border-black/5 my-2" />
            {user ? (
              <>
                <Link
                  href="/account"
                  className="px-4 py-3.5 rounded-xl text-sm font-semibold hover:bg-black/5 min-h-[44px] flex items-center"
                >
                  My account
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="px-4 py-3.5 rounded-xl text-sm font-semibold hover:bg-black/5 min-h-[44px] flex items-center"
                  >
                    Admin dashboard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="px-4 py-3.5 rounded-xl text-sm font-semibold text-left text-soul-muted hover:bg-black/5 min-h-[44px] w-full"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-3.5 rounded-xl text-sm font-semibold hover:bg-black/5 min-h-[44px] flex items-center"
              >
                Sign in / Register
              </Link>
            )}
          </nav>
        </div>
      </div>

      <div className="nav-spacer" aria-hidden />
    </>
  );
}
