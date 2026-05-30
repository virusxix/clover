/**
 * JWT access & refresh token helpers
 */
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query } from "../db.js";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: "refresh" }, SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Persist refresh token hash for rotation / revocation */
export async function storeRefreshToken(userId, refreshToken) {
  try {
    const decoded = jwt.decode(refreshToken);
    const expiresAt = new Date(decoded.exp * 1000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, hashToken(refreshToken), expiresAt]
    );
  } catch {
    /* dev mode without DB — JWT refresh still works until expiry */
  }
}

export async function revokeRefreshToken(refreshToken) {
  try {
    await query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [hashToken(refreshToken)]);
  } catch {
    /* dev mode */
  }
}

export async function isRefreshValid(refreshToken) {
  try {
    const { rows } = await query(
      `SELECT 1 FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [hashToken(refreshToken)]
    );
    return rows.length > 0;
  } catch {
    return true;
  }
}
