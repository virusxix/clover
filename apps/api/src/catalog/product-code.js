/**
 * Product codes — THE CLOVER convention
 * ------------------------------------
 * Example: SO1pljk
 *   SO  = line prefix
 *   1   = style sequence number
 *   p   = polyester (fabric)
 *   l   = long (length / sleeve)
 *   jk  = jacket (garment type)
 *
 * Full: {PREFIX}{SEQ}{FABRIC}{LENGTH}{TYPE}
 */

export const PRODUCT_CODE_PREFIX = "SO";

/** Single-letter fabric codes */
export const FABRICS = {
  p: "Polyester",
  n: "Nylon",
  c: "Cotton",
  e: "Elastane blend",
  m: "Mesh",
};

/** Single-letter length / sleeve codes */
export const LENGTHS = {
  l: "Long",
  s: "Short",
  r: "Regular",
  m: "Midi",
};

/** Two-letter garment type codes (aligned with shop categories) */
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
};

/** category_id → default type + length */
export const CATEGORY_DEFAULTS = {
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

/**
 * @param {{ seq: number, fabric: string, length: string, type: string, prefix?: string }} parts
 */
export function buildProductCode({
  seq,
  fabric,
  length,
  type,
  prefix = PRODUCT_CODE_PREFIX,
}) {
  const n = Number(seq);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("Product code sequence must be a positive integer");
  }
  if (!FABRICS[fabric]) throw new Error(`Unknown fabric code: ${fabric}`);
  if (!LENGTHS[length]) throw new Error(`Unknown length code: ${length}`);
  if (!TYPES[type]) throw new Error(`Unknown type code: ${type}`);
  return `${prefix}${n}${fabric}${length}${type}`;
}

/**
 * Parse SO1pljk → { prefix, seq, fabric, length, type } or null
 * @param {string} code
 */
export function parseProductCode(code) {
  if (!code || typeof code !== "string") return null;
  const m = code.trim().match(/^(SO)(\d+)([a-z])([a-z])([a-z]{2})$/i);
  if (!m) return null;
  const fabric = m[3].toLowerCase();
  const length = m[4].toLowerCase();
  const type = m[5].toLowerCase();
  if (!FABRICS[fabric] || !LENGTHS[length] || !TYPES[type]) return null;
  return {
    prefix: m[1].toUpperCase(),
    seq: parseInt(m[2], 10),
    fabric,
    length,
    type,
  };
}

/**
 * Human-readable breakdown, e.g. "SO1 · Polyester · Long · Jacket"
 * @param {string} code
 */
export function describeProductCode(code) {
  const p = parseProductCode(code);
  if (!p) return code || "";
  return `${p.prefix}${p.seq} · ${FABRICS[p.fabric]} · ${LENGTHS[p.length]} · ${TYPES[p.type]}`;
}

/**
 * Next free SO sequence from existing product_code values.
 * @param {(text: string, params?: unknown[]) => Promise<{ rows: any[] }>} query
 */
export async function nextProductSeq(query) {
  const { rows } = await query(
    `SELECT product_code FROM products
     WHERE product_code IS NOT NULL AND product_code ~ '^SO[0-9]+'`
  );
  let max = 0;
  for (const r of rows) {
    const m = String(r.product_code).match(/^SO(\d+)/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/**
 * Freeform style / SKU codes (not only the SO… convention).
 * Letters, digits, hyphen, underscore, dot — 2–32 chars.
 * @param {string} raw
 */
export function isValidFreeformProductCode(raw) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/.test(raw);
}

/**
 * Resolve a product_code from body fields (typed code preferred).
 * Accepts any specific code (e.g. SO1pljk, JK-001, BRA_RED), or builds SO… from parts.
 * @param {{ productCode?: string, fabric?: string, length?: string, type?: string, categoryId?: string, seq?: number }} input
 * @param {(text: string, params?: unknown[]) => Promise<{ rows: any[] }>} query
 */
export async function resolveProductCode(input, query) {
  if (input.productCode && String(input.productCode).trim()) {
    const raw = String(input.productCode).trim().replace(/\s+/g, "");
    const parsed = parseProductCode(raw);
    if (parsed) return buildProductCode(parsed);
    if (!isValidFreeformProductCode(raw)) {
      throw new Error(
        `Invalid product code "${raw}" — use 2–32 letters/numbers (hyphen, underscore, or dot OK)`
      );
    }
    return raw;
  }

  const defaults = CATEGORY_DEFAULTS[input.categoryId || ""] || {
    type: "tp",
    length: "r",
  };
  const fabric = (input.fabric || "p").toLowerCase();
  const length = (input.length || defaults.length).toLowerCase();
  const type = (input.type || defaults.type).toLowerCase();
  const seq = input.seq != null ? Number(input.seq) : await nextProductSeq(query);
  return buildProductCode({ seq, fabric, length, type });
}
