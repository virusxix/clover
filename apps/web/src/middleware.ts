/**
 * Edge middleware — three portals: customer, admin, reception.
 * API still enforces live DB role on every privileged route.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CUSTOMER_AUTH = ["/account", "/cart", "/checkout"];

function hasSessionCookie(req: NextRequest) {
  return Boolean(req.cookies.get("accessToken")?.value || req.cookies.get("refreshToken")?.value);
}

function roleHint(req: NextRequest) {
  return (req.cookies.get("cloverRole")?.value || "").trim();
}

function redirectTo(req: NextRequest, pathname: string, search = "") {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url);
}

function applySecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("X-DNS-Prefetch-Control", "on");
  return res;
}

function isReceptionApp(pathname: string) {
  return pathname === "/reception" || pathname.startsWith("/reception/");
}
function isReceptionLogin(pathname: string) {
  return pathname === "/reception/login";
}
function isAdminApp(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
function isAdminLogin(pathname: string) {
  return pathname === "/admin/login";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api")) {
    return applySecurityHeaders(NextResponse.next());
  }

  const res = applySecurityHeaders(NextResponse.next());
  const authed = hasSessionCookie(req);
  const role = roleHint(req);

  // ── Reception: only /reception/* ────────────────────────────
  if (role === "reception") {
    if (isReceptionLogin(pathname) && authed) {
      return applySecurityHeaders(redirectTo(req, "/reception"));
    }
    if (!isReceptionApp(pathname)) {
      return applySecurityHeaders(redirectTo(req, "/reception"));
    }
    if (!isReceptionLogin(pathname) && !authed) {
      return applySecurityHeaders(redirectTo(req, "/reception/login"));
    }
    return res;
  }

  // ── Admin: /admin/* + /reception/* (floor tools) ────────────
  if (role === "admin") {
    if (isAdminLogin(pathname) && authed) {
      return applySecurityHeaders(redirectTo(req, "/admin"));
    }
    if (pathname === "/login") {
      return applySecurityHeaders(redirectTo(req, "/admin/login"));
    }
    if (isReceptionLogin(pathname)) {
      return applySecurityHeaders(redirectTo(req, "/reception"));
    }
    const allowed = isAdminApp(pathname) || isReceptionApp(pathname);
    if (!allowed) {
      return applySecurityHeaders(redirectTo(req, "/admin"));
    }
    if (isAdminApp(pathname) && !isAdminLogin(pathname) && !authed) {
      return applySecurityHeaders(redirectTo(req, "/admin/login"));
    }
    if (isReceptionApp(pathname) && !authed) {
      return applySecurityHeaders(redirectTo(req, "/admin/login"));
    }
    return res;
  }

  // ── Public staff login pages ────────────────────────────────
  if (isAdminLogin(pathname) || isReceptionLogin(pathname)) {
    return res;
  }

  // ── Unauthenticated staff dashboards → correct login ────────
  if (isAdminApp(pathname)) {
    if (!authed) return applySecurityHeaders(redirectTo(req, "/admin/login"));
    if (role && role !== "admin") {
      return applySecurityHeaders(redirectTo(req, role === "reception" ? "/reception" : "/account"));
    }
    return res;
  }

  if (isReceptionApp(pathname)) {
    if (!authed) return applySecurityHeaders(redirectTo(req, "/reception/login"));
    if (role && role !== "admin" && role !== "reception") {
      return applySecurityHeaders(redirectTo(req, "/account"));
    }
    return res;
  }

  // Wrong portal cookies hitting customer login
  if (pathname === "/login") {
    if (role === "admin") return applySecurityHeaders(redirectTo(req, "/admin/login"));
    if (role === "reception") return applySecurityHeaders(redirectTo(req, "/reception/login"));
  }

  const needsCustomerAuth = CUSTOMER_AUTH.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (needsCustomerAuth && !authed) {
    const next = `${pathname}${req.nextUrl.search}`;
    return applySecurityHeaders(
      redirectTo(req, "/login", `?next=${encodeURIComponent(next)}`)
    );
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
