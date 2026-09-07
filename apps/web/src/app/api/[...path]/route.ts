/**
 * Same-origin API proxy (Vercel → Render)
 * --------------------------------------
 * Browser calls /api/* on the Vercel host; this forwards to NEXT_PUBLIC_API_URL.
 * Forwards Set-Cookie correctly (rewrites often break auth cookies) and retries
 * when the Render free tier is cold — common on slower Myanmar connections.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Hobby plan caps lower; still ask for headroom when available. */
export const maxDuration = 60;

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const base = apiBase();
  if (!base || !/^https?:\/\//i.test(base)) {
    return NextResponse.json(
      {
        error: "API not configured",
        hint: "Set NEXT_PUBLIC_API_URL to your Render API URL in Vercel env, then redeploy.",
      },
      { status: 503 }
    );
  }

  const { path } = await ctx.params;
  const subpath = path.join("/");
  const target = `${base}/api/${subpath}${req.nextUrl.search}`;

  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const authorization = req.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  headers.set("accept", req.headers.get("accept") || "application/json");

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let lastStatus = 503;
  let lastBody: ArrayBuffer | null = null;
  let lastContentType: string | null = null;
  let lastCookies: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const upstream = await fetch(target, {
        method,
        headers,
        body: hasBody ? body : undefined,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(50_000),
      });

      lastStatus = upstream.status;
      lastContentType = upstream.headers.get("content-type");
      lastCookies =
        typeof upstream.headers.getSetCookie === "function"
          ? upstream.headers.getSetCookie()
          : [];
      lastBody = await upstream.arrayBuffer();

      // Retry only transient upstream failures (cold start / gateway)
      if ([502, 503, 504].includes(upstream.status) && attempt < 2) {
        await sleep(2500 * (attempt + 1));
        continue;
      }
      break;
    } catch {
      if (attempt < 2) {
        await sleep(2500 * (attempt + 1));
        continue;
      }
      return NextResponse.json(
        {
          error: "Cannot reach API",
          hint: "Server may be waking up. Wait ~30 seconds and try again.",
        },
        { status: 503 }
      );
    }
  }

  const out = new Headers();
  if (lastContentType) out.set("content-type", lastContentType);

  for (const c of lastCookies) {
    // Bind cookies to this host (drop upstream Domain=). Keep Secure only in prod.
    let cleaned = c.replace(/;\s*Domain=[^;]*/gi, "");
    if (process.env.NODE_ENV !== "production") {
      cleaned = cleaned.replace(/;\s*Secure/gi, "");
    }
    out.append("set-cookie", cleaned);
  }

  // Auth fallback: if upstream JSON has tokens but Set-Cookie was lost, set them here
  const isAuthSession =
    subpath === "auth/login" ||
    subpath === "auth/register" ||
    subpath === "auth/refresh";

  if (isAuthSession && lastContentType?.includes("application/json") && lastBody) {
    try {
      const data = JSON.parse(new TextDecoder().decode(lastBody)) as {
        user?: { role?: string };
        ok?: boolean;
        accessToken?: string;
        refreshToken?: string;
        error?: unknown;
      };

      const payload =
        subpath === "auth/refresh"
          ? data.error
            ? { error: data.error }
            : { ok: true, user: data.user || undefined }
          : data.user
            ? { user: data.user }
            : data.error
              ? { error: data.error }
              : { ok: true };

      const res = NextResponse.json(payload, { status: lastStatus, headers: out });

      const secure = process.env.NODE_ENV === "production";
      const cookieBase = {
        httpOnly: true,
        secure,
        sameSite: "lax" as const,
        path: "/",
      };

      if (data.accessToken && lastCookies.length === 0) {
        res.cookies.set("accessToken", data.accessToken, {
          ...cookieBase,
          maxAge: 60 * 15,
        });
      }
      if (data.refreshToken && lastCookies.length === 0) {
        res.cookies.set("refreshToken", data.refreshToken, {
          ...cookieBase,
          maxAge: 60 * 60 * 24 * 7,
        });
      }
      // Always sync role gate cookie from live user when present (login / register / refresh).
      const role = data.user?.role;
      if (role === "admin" || role === "reception" || role === "customer") {
        res.cookies.set("cloverRole", role, {
          ...cookieBase,
          maxAge: 60 * 60 * 24 * 7,
        });
      }
      return res;
    } catch {
      // Never forward raw auth bodies (may contain JWTs).
      return NextResponse.json(
        { error: "Auth response could not be parsed" },
        { status: lastStatus >= 400 ? lastStatus : 502, headers: out }
      );
    }
  }

  // /auth/me sets cloverRole via upstream Set-Cookie — already forwarded above.
  return new NextResponse(lastBody, { status: lastStatus, headers: out });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
