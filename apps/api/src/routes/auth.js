/**
 * Auth HTTP routes
 * ----------------
 * One job: map HTTP requests → auth-data / auth-session.
 * Validation and response status codes live here; business logic does not.
 */

import { Router } from "express";
import { z } from "zod";
import { hashPassword, comparePassword } from "../utils/password.js";
import { revokeRefreshToken } from "../utils/jwt.js";
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
import { clearAuthCookies, readRefreshToken } from "../auth-cookies.js";
import { createSession, rotateSession } from "../auth-session.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
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

/** POST /api/auth/login — verify password + session cookies */
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
    await rotateSession(res, refreshToken);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

/** POST /api/auth/logout — revoke refresh hash + clear cookies */
router.post("/logout", async (req, res) => {
  const refreshToken = readRefreshToken(req);
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch {
      // Best effort — still clear cookies below.
    }
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

/** GET /api/auth/me — current user from access cookie */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
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
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: authErrorMessage(err) });
  }
});

export default router;
