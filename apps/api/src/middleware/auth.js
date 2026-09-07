/**
 * JWT authentication middleware
 * -----------------------------
 * Layer 1: valid access token (cookie or Bearer)
 * Layer 2: live DB role check for privileged roles (never trust JWT role alone)
 *
 * Roles:
 *   customer  — own cart/orders/wishlist/profile only (user_id filters in routes)
 *   reception — floor only: POS, inventory, ICONIC, orders, customers
 *   admin     — owner console (catalog, users, analytics, settings)
 */

import { verifyToken } from "../utils/jwt.js";
import { query } from "../db.js";

const RECEPTION_ROLE = "reception";
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
 * Floor portal — reception only (POS, inventory, ICONIC, web orders, customers).
 * Admins use /admin; they do not share floor APIs.
 */
export async function requireReception(req, res, next) {
  try {
    const role = await liveRole(req.user?.id);
    if (role !== RECEPTION_ROLE) {
      return res.status(403).json({ error: "Reception access required" });
    }
    req.user.role = RECEPTION_ROLE;
    next();
  } catch (err) {
    console.error("[requireReception]", err.message);
    return res.status(503).json({ error: "Could not verify reception access" });
  }
}

/** @deprecated Floor is reception-only — alias of requireReception. */
export const requireStoreStaff = requireReception;
export const requireReceptionOrAdmin = requireReception;

async function liveRole(userId) {
  if (!userId) return null;
  const { rows } = await query(`SELECT role FROM users WHERE id = $1`, [userId]);
  return rows[0]?.role || null;
}

export function isReceptionRole(role) {
  return role === RECEPTION_ROLE;
}

export function isStoreStaffRole(role) {
  return role === RECEPTION_ROLE || role === ADMIN_ROLE;
}

export function isAdminRole(role) {
  return role === ADMIN_ROLE;
}
