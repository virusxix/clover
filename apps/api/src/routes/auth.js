/**
 * Auth HTTP routes
 * ----------------
 * One job: map HTTP requests → auth-data / auth-session.
 * Validation and response status codes live here; business logic does not.
 */

import { Router } from "express";
import { z } from "zod";
import { hashPassword, comparePassword } from "../utils/password.js";
import { revokeRefreshToken, revokeAllRefreshTokens, verifyToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import {
  verifyLogin,
  createUser,
  getUserById,
  toUserResponse,
  authErrorMessage,
  checkDb,
} from "../auth-data.js";
import { query } from "../db.js";
import { clearAuthCookies, readRefreshToken, setRoleCookie } from "../auth-cookies.js";
import { createSession, rotateSession } from "../auth-session.js";
import { writeAudit } from "../audit.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  /** Which portal is signing in — role must match */
  portal: z.enum(["customer", "admin", "reception"]).optional().default("customer"),
});

const profileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(32).optional().nullable(),
});

const passwordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

/** POST /api/auth/register — create account + session cookies */
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid registration data" });
  }

  try {
    const { email, password, fullName } = parsed.data;
    const user = await createUser(email, password, fullName);
    if (!user) {
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(201).json(await createSession(res, user));
  } catch (err) {
    console.error("[auth/register]", err);
    res.status(500).json({ error: authErrorMessage(err) });
  }
});

/** POST /api/auth/login — verify password + session cookies (portal-scoped) */
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  try {
    const user = await verifyLogin(parsed.data.email, parsed.data.password);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const portal = parsed.data.portal || "customer";

    if (portal === "customer") {
      if (user.role !== "customer") {
        // Same response as a bad password — do not reveal staff portals on the shop login.
        return res.status(401).json({ error: "Invalid email or password" });
      }
    } else if (portal === "admin") {
      if (user.role !== "admin") {
        return res.status(403).json({
          error: "Invalid email or password",
          code: "WRONG_PORTAL",
        });
      }
    } else if (portal === "reception") {
      if (user.role !== "reception") {
        return res.status(403).json({
          error: "Invalid email or password",
          code: "WRONG_PORTAL",
        });
      }
    }

    res.json(await createSession(res, user));
  } catch (err) {
    console.error("[auth/login]", err);
    res.status(500).json({ error: authErrorMessage(err) });
  }
});

/** POST /api/auth/refresh — rotate tokens using refresh cookie */
router.post("/refresh", async (req, res) => {
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token required" });
  }

  try {
    const rotated = await rotateSession(res, refreshToken);
    res.json({ ok: true, ...rotated });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

/** POST /api/auth/logout — revoke all refresh sessions for this user + clear cookies */
router.post("/logout", async (req, res) => {
  const refreshToken = readRefreshToken(req);
  if (refreshToken) {
    try {
      const payload = verifyToken(refreshToken);
      if (payload?.sub) {
        await revokeAllRefreshTokens(payload.sub);
      } else {
        await revokeRefreshToken(refreshToken);
      }
    } catch {
      try {
        await revokeRefreshToken(refreshToken);
      } catch {
        /* still clear cookies */
      }
    }
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

/** GET /api/auth/me — current user from access cookie; refresh role cookie from DB */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    setRoleCookie(res, user.role);
    res.json(toUserResponse(user));
  } catch (err) {
    res.status(500).json({ error: authErrorMessage(err) });
  }
});

/** PATCH /api/auth/profile — update name / phone */
router.patch("/profile", requireAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  try {
    // Dev fallback: mutate in-memory user when DB is offline.
    if (!(await checkDb())) {
      const user = await getUserById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (parsed.data.fullName) user.full_name = parsed.data.fullName;
      if (parsed.data.phone !== undefined) user.phone = parsed.data.phone;
      return res.json(toUserResponse(user));
    }

    const { fullName, phone } = parsed.data;
    const { rows } = await query(
      `UPDATE users SET
         full_name = COALESCE($2, full_name),
         phone = COALESCE($3, phone)
       WHERE id = $1
       RETURNING id, email, full_name, role, phone`,
      [req.user.id, fullName, phone]
    );
    res.json(toUserResponse(rows[0]));
  } catch (err) {
    res.status(500).json({ error: authErrorMessage(err) });
  }
});

/** PATCH /api/auth/password — change password after verifying current one */
router.patch("/password", requireAuth, async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  try {
    const user = await getUserById(req.user.id, { withPassword: true });
    if (!user) return res.status(404).json({ error: "User not found" });

    const ok = await comparePassword(
      parsed.data.currentPassword,
      user.password_hash
    );
    if (!ok) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hash = await hashPassword(parsed.data.newPassword);
    if (await checkDb()) {
      await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [
        req.user.id,
        hash,
      ]);
    } else {
      user.password_hash = hash;
    }

    // Kill every other session; re-issue cookies for this browser only.
    try {
      await revokeAllRefreshTokens(req.user.id);
    } catch {
      /* best effort */
    }
    const fresh = await getUserById(req.user.id);
    await writeAudit({
      actorId: req.user.id,
      action: "password_change",
      targetType: "user",
      targetId: req.user.id,
      req,
    });
    const session = await createSession(res, fresh || user);
    // Never put JWTs in the JSON body for password change (proxy may forward raw).
    res.json({ ok: true, user: session.user });
  } catch (err) {
    res.status(500).json({ error: authErrorMessage(err) });
  }
});

export default router;
