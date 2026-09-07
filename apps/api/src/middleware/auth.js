/**
 * JWT authentication middleware
 * -----------------------------
 * Layer 1: valid access token (cookie or Bearer)
 * Layer 2: live DB role check for privileged roles (never trust JWT role alone)
 *
 * Roles:
 *   customer  — own cart/orders/wishlist/profile only (user_id filters in routes)
 *   reception — store floor (requireStoreStaff); no catalog admin / users / settings / analytics
 *   admin     — full manage (requireAdmin + live DB check)
 */

import { verifyToken } from "../utils/jwt.js";
import { query } from "../db.js";

const STORE_STAFF_ROLES = new Set(["admin", "reception"]);
const ADMIN_ROLE = "admin";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = verifyToken(token);
    if (payload.type === "refresh") {
      return res.status(401).json({ error: "Invalid token type" });
    }
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Owner console — admin only (live DB role). */
export async function requireAdmin(req, res, next) {
  try {
    const role = await liveRole(req.user?.id);
    if (role !== ADMIN_ROLE) {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.user.role = ADMIN_ROLE;
    next();
  } catch (err) {
    console.error("[requireAdmin]", err.message);
    return res.status(503).json({ error: "Could not verify admin access" });
  }
}

/**
 * Store floor — admin or reception (POS, inventory, ICONIC, web orders, customers).
 * Does not grant owner analytics / users / catalog admin / settings / uploads.
 */
export async function requireStoreStaff(req, res, next) {
  try {
    const role = await liveRole(req.user?.id);
    if (!STORE_STAFF_ROLES.has(role)) {
      return res.status(403).json({ error: "Store staff access required" });
    }
    req.user.role = role;
    next();
  } catch (err) {
    console.error("[requireStoreStaff]", err.message);
    return res.status(503).json({ error: "Could not verify staff access" });
  }
}

/** Explicit reception-or-admin check (alias of store staff for clarity at call sites). */
export const requireReceptionOrAdmin = requireStoreStaff;

async function liveRole(userId) {
  if (!userId) return null;
  const { rows } = await query(`SELECT role FROM users WHERE id = $1`, [userId]);
  return rows[0]?.role || null;
}

export function isStoreStaffRole(role) {
  return STORE_STAFF_ROLES.has(role);
}

export function isAdminRole(role) {
  return role === ADMIN_ROLE;
}
