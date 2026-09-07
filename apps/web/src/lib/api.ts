/**
 * HTTP client for the Clover API
 * ------------------------------
 * One job: fetch JSON from /api/* with cookies, and throw ApiError on failure.
 * Browser calls go same-origin (Vercel route proxy). Server calls use NEXT_PUBLIC_API_URL.
 * On 401, tries one silent refresh then retries (keeps admin forms working past 15m access TTL).
 */

type FetchOpts = RequestInit & {
  json?: unknown;
  next?: { revalidate?: number | false };
  /** Extra retries for slow networks / cold API (default 0). */
  retries?: number;
  /** Skip refresh-on-401 (login / refresh / logout). */
  skipAuthRefresh?: boolean;
};

/** Error with HTTP status so callers can tell 401 from 500. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Base URL: empty in the browser (same-origin proxy), absolute on the server. */
function getApiBase() {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

/** Turn API error payloads into a single readable string. */
function readErrorMessage(data: Record<string, unknown>, status: number) {
  const err = data.error;
  const hint = typeof data.hint === "string" ? data.hint : "";
  let base = "";
  if (typeof err === "string") base = err;
  else if (err && typeof err === "object" && "message" in err) {
    base = String((err as { message: unknown }).message);
  }
  if (base && hint) return `${base} — ${hint}`;
  if (base) return base;
  if (hint) return hint;
  return `Request failed (${status})`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isAuthPath(path: string) {
  return (
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/register") ||
    path.startsWith("/api/auth/refresh") ||
    path.startsWith("/api/auth/logout")
  );
}

let refreshInFlight: Promise<boolean> | null = null;

/** One shared refresh so parallel 401s do not stampede /auth/refresh. */
async function tryRefreshSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { accept: "application/json" },
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/** Typed JSON fetch helper used across the storefront. */
export async function api<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { json, headers, next, retries = 0, skipAuthRefresh, ...rest } = opts;
  const attempts = Math.max(1, retries + 1);
  let lastError: unknown;
  let didRefresh = false;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${getApiBase()}${path}`, {
        ...rest,
        ...(next ? { next } : {}),
        credentials: "include",
        headers: {
          ...(json ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: json !== undefined ? JSON.stringify(json) : rest.body,
      });

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        if (
          res.status === 401 &&
          !didRefresh &&
          !skipAuthRefresh &&
          !isAuthPath(path)
        ) {
          didRefresh = true;
          const ok = await tryRefreshSession();
          if (ok) {
            i -= 1; // retry this attempt after refresh
            continue;
          }
        }

        const retryable = [408, 425, 429, 502, 503, 504].includes(res.status);
        if (retryable && i < attempts - 1) {
          await sleep(2000 * (i + 1));
          continue;
        }
        throw new ApiError(readErrorMessage(data, res.status), res.status);
      }

      return data as T;
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError) throw err;
      if (i < attempts - 1) {
        await sleep(2000 * (i + 1));
        continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ApiError("Network error — check connection and try again", 0);
}

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: "customer" | "admin" | "reception";
  phone?: string;
};

export type ProductListItem = {
  id: string;
  slug: string;
  productCode?: string | null;
  name: string;
  description: string;
  categoryId: string;
  gender: string;
  activity: string;
  featured: boolean;
  tags?: string[];
  price: number;
  compareAtPrice?: number | null;
  onSale?: boolean;
  discountPercent?: number | null;
  colorName: string;
  colorHex: string;
  imageUrl?: string;
  variantId: string;
};
