/**
 * Product codes — THE CLOVER (client mirror of API legend)
 * Example: SO1pljk = SO + 1 + p(polyester) + l(long) + jk(jacket)
 */

export const PRODUCT_CODE_PREFIX = "SO";

export const FABRICS = {
  p: "Polyester",
  n: "Nylon",
  c: "Cotton",
  e: "Elastane blend",
  m: "Mesh",
} as const;

export const LENGTHS = {
  l: "Long",
  s: "Short",
  r: "Regular",
  m: "Midi",
} as const;

export const TYPES = {
  jk: "Jacket",
  ls: "Long sleeve",
  ss: "Short sleeve",
  sh: "Shorts",
  sk: "Skirt",
  lg: "Leggings",
  fp: "Flare pants",
  bp: "Biker pants",
  tp: "Tops & bras",
  ac: "Accessories",
} as const;

export const CATEGORY_DEFAULTS: Record<string, { type: keyof typeof TYPES; length: keyof typeof LENGTHS }> = {
  jackets: { type: "jk", length: "l" },
  "long-sleeve": { type: "ls", length: "l" },
  "short-sleeve": { type: "ss", length: "s" },
  shorts: { type: "sh", length: "s" },
  skirts: { type: "sk", length: "r" },
  leggings: { type: "lg", length: "l" },
  "flare-pants": { type: "fp", length: "l" },
  "biker-pants": { type: "bp", length: "s" },
  tops: { type: "tp", length: "r" },
  accessories: { type: "ac", length: "r" },
};

export function buildProductCode(parts: {
  seq: number;
  fabric: keyof typeof FABRICS;
  length: keyof typeof LENGTHS;
  type: keyof typeof TYPES;
  prefix?: string;
}) {
  const prefix = parts.prefix ?? PRODUCT_CODE_PREFIX;
  return `${prefix}${parts.seq}${parts.fabric}${parts.length}${parts.type}`;
}

export function parseProductCode(code: string | null | undefined) {
  if (!code) return null;
  const m = code.trim().match(/^(SO)(\d+)([a-z])([a-z])([a-z]{2})$/i);
  if (!m) return null;
  const fabric = m[3].toLowerCase() as keyof typeof FABRICS;
  const length = m[4].toLowerCase() as keyof typeof LENGTHS;
  const type = m[5].toLowerCase() as keyof typeof TYPES;
  if (!FABRICS[fabric] || !LENGTHS[length] || !TYPES[type]) return null;
  return {
    prefix: m[1].toUpperCase(),
    seq: parseInt(m[2], 10),
    fabric,
    length,
    type,
  };
}

export function describeProductCode(code: string | null | undefined) {
  const p = parseProductCode(code);
  if (!p) return code || "";
  return `${p.prefix}${p.seq} · ${FABRICS[p.fabric]} · ${LENGTHS[p.length]} · ${TYPES[p.type]}`;
}
