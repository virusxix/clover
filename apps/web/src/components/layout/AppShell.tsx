"use client";

/**
 * Root chrome — shop Header/Footer only on the customer storefront.
 */

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const staffPortal =
    pathname === "/reception" ||
    pathname.startsWith("/reception/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (staffPortal) {
    return <div className="flex-1 w-full min-w-0 min-h-screen flex flex-col">{children}</div>;
  }

  return (
    <>
      <Suspense fallback={<div className="nav-spacer" aria-hidden />}>
        <Header />
      </Suspense>
      <main className="flex-1 w-full min-w-0 overflow-x-hidden">{children}</main>
      <Footer />
    </>
  );
}
