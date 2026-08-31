/**
 * HTTP client for the Clover API
 * ------------------------------
 * One job: fetch JSON from /api/* with cookies, and throw ApiError on failure.
 * Browser calls go same-origin (Next rewrite). Server calls use NEXT_PUBLIC_API_URL.
 */

type FetchOpts = RequestInit & {
  json?: unknown;
  next?: { revalidate?: number | false };
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

/** Base URL: empty in the browser (rewrite proxy), absolute on the server. */
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

/** Typed JSON fetch helper used across the storefront. */
export async function api<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { json, headers, next, ...rest } = opts;

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
    throw new ApiError(readErrorMessage(data, res.status), res.status);
  }

  return data as T;
}

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: "customer" | "admin";
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
