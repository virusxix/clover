/**
 * JWT authentication middleware
 * -----------------------------
 * Layer 1: valid access token (cookie or Bearer)
 * Layer 2 (admin): live DB role check so demotions take effect immediately
 */

import { verifyToken } from "../utils/jwt.js";
import { query } from "../db.js";

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

export async function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const { rows } = await query(`SELECT role FROM users WHERE id = $1`, [req.user.id]);
    if (!rows.length || rows[0].role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    // Prefer live role over possibly-stale JWT claim
    req.user.role = "admin";
    next();
  } catch (err) {
    console.error("[requireAdmin]", err.message);
    return res.status(503).json({ error: "Could not verify admin access" });
  }
}
