/**
 * Edge middleware — first line of defense for the storefront.
 * Cookie presence gates private routes; API still enforces JWT + roles.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PREFIXES = ["/account", "/cart", "/checkout"];
const ADMIN_PREFIX = "/admin";

function hasSessionCookie(req: NextRequest) {
  return Boolean(req.cookies.get("accessToken")?.value || req.cookies.get("refreshToken")?.value);
}

function loginRedirect(req: NextRequest) {
  const next = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // Baseline browser hardening on every response this middleware touches.
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("X-DNS-Prefetch-Control", "on");

  const needsAuth =
    AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname === ADMIN_PREFIX ||
    pathname.startsWith(`${ADMIN_PREFIX}/`);

  if (needsAuth && !hasSessionCookie(req)) {
    return loginRedirect(req);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/cart", "/checkout", "/account"],
};
