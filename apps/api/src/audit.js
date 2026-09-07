/**
 * Privileged action audit log
 * ---------------------------
 * Best-effort writes — never block the primary action on audit failure.
 */

import { query } from "../db.js";

/**
 * @param {{
 *   actorId?: string|null,
 *   action: string,
 *   targetType?: string,
 *   targetId?: string|null,
 *   meta?: Record<string, unknown>,
 *   req?: { ip?: string, headers?: { [k: string]: string|string[]|undefined }, socket?: { remoteAddress?: string } }
 * }} opts
 */
export async function writeAudit(opts) {
  const { actorId = null, action, targetType = "", targetId = null, meta = {}, req } = opts;
  if (!action) return;

  let ip = null;
  let userAgent = null;
  if (req) {
    const xf = req.headers?.["x-forwarded-for"];
    const forwarded = Array.isArray(xf) ? xf[0] : xf;
    ip = (forwarded && String(forwarded).split(",")[0].trim()) || req.ip || req.socket?.remoteAddress || null;
    const ua = req.headers?.["user-agent"];
    userAgent = Array.isArray(ua) ? ua[0] : ua || null;
  }

  try {
    await query(
      `INSERT INTO admin_audit_events (actor_id, action, target_type, target_id, meta, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        actorId,
        String(action).slice(0, 64),
        String(targetType || "").slice(0, 64),
        targetId != null ? String(targetId).slice(0, 64) : null,
        JSON.stringify(meta || {}),
        ip ? String(ip).slice(0, 64) : null,
        userAgent ? String(userAgent).slice(0, 500) : null,
      ]
    );
  } catch (err) {
    console.error("[audit]", err.message || err);
  }
}

/** Express helper: bind actor + req */
export function auditFromReq(req, action, targetType, targetId, meta) {
  return writeAudit({
    actorId: req.user?.id || null,
    action,
    targetType,
    targetId,
    meta,
    req,
  });
}
