function getApiBase() {
  if (typeof window !== "undefined") return ""; // browser → Next.js rewrite proxy
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

type FetchOpts = RequestInit & {
  json?: unknown;
  next?: { revalidate?: number | false };
};

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

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error;
    const msg =
      typeof err === "string"
        ? err
        : err?.message || data.hint || `Request failed (${res.status})`;
    throw new Error(msg);
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
