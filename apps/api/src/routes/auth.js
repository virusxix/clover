/**
 * Authentication: register, login, refresh, profile, password
 */
import { Router } from "express";
import { z } from "zod";
import { hashPassword, comparePassword } from "../utils/password.js";
import {
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  isRefreshValid,
  verifyToken,
} from "../utils/jwt.js";
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

function setAuthCookies(res, accessToken, refreshToken) {
  const isProd = process.env.NODE_ENV === "production";
  const opts = { httpOnly: true, secure: isProd, sameSite: "lax", path: "/" };
  res.cookie("accessToken", accessToken, { ...opts, maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { ...opts, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function issueSession(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  storeRefreshToken(user.id, refreshToken);
  setAuthCookies(res, accessToken, refreshToken);
  return { user: toUserResponse(user), accessToken };
}

/** POST /api/auth/register */
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid registration data" });
  }

  const { email, password, fullName } = parsed.data;

  try {
    const user = await createUser(email, password, fullName);
    if (!user) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const session = issueSession(res, user);
    res.status(201).json(session);
  } catch (err) {
    console.error("[auth/register]", err);
    res.status(500).json({ error: authErrorMessage(err) });
  }
});

/** POST /api/auth/login */
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const { email, password } = parsed.data;

  try {
    const user = await verifyLogin(email, password);
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
        hint: !(await checkDb())
          ? "Database offline — use admin@clover.com / Admin123! (dev mode)"
          : undefined,
      });
    }
    res.json(issueSession(res, user));
  } catch (err) {
    console.error("[auth/login]", err);
    res.status(500).json({ error: authErrorMessage(err) });
  }
});

/** POST /api/auth/refresh */
router.post("/refresh", async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token required" });
  }

  try {
    const payload = verifyToken(refreshToken);
    if (payload.type !== "refresh") {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    if (!(await isRefreshValid(refreshToken))) {
      return res.status(401).json({ error: "Refresh token revoked or expired" });
    }

    const user = await getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    await revokeRefreshToken(refreshToken);
    const accessToken = signAccessToken(user);
    const newRefresh = signRefreshToken(user);
    await storeRefreshToken(user.id, newRefresh);
    setAuthCookies(res, accessToken, newRefresh);

    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

/** POST /api/auth/logout */
router.post("/logout", async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ ok: true });
});

/** GET /api/auth/me */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(toUserResponse(user));
  } catch (err) {
    res.status(500).json({ error: authErrorMessage(err) });
  }
});

/** PATCH /api/auth/profile */
router.patch("/profile", requireAuth, async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2).max(120).optional(),
    phone: z.string().max(32).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  try {
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

/** PATCH /api/auth/password */
router.patch("/password", requireAuth, async (req, res) => {
  const schema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!(await comparePassword(parsed.data.currentPassword, user.password_hash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    if (await checkDb()) {
      const hash = await hashPassword(parsed.data.newPassword);
      await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [req.user.id, hash]);
    } else {
      user.password_hash = await hashPassword(parsed.data.newPassword);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: authErrorMessage(err) });
  }
});

export default router;
