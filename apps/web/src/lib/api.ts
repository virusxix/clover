/**
 * HTTP client for the Clover API
 * ------------------------------
 * One job: fetch JSON from /api/* with cookies, and throw ApiError on failure.
 * Browser calls go same-origin (Vercel route proxy). Server calls use NEXT_PUBLIC_API_URL.
 */

type FetchOpts = RequestInit & {
  json?: unknown;
  next?: { revalidate?: number | false };
  /** Extra retries for slow networks / cold API (default 0). */
  retries?: number;
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

/** Typed JSON fetch helper used across the storefront. */
export async function api<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { json, headers, next, retries = 0, ...rest } = opts;
  const attempts = Math.max(1, retries + 1);
  let lastError: unknown;

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
        body: json ? JSON.stringify(json) : rest.body,
      });

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
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
