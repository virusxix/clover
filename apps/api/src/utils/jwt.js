/**
 * JWT helpers
 * -----------
 * One job: sign / verify JWTs and track refresh tokens in Postgres.
 * Does not set cookies — that lives in auth-cookies.js / auth-session.js.
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query } from "../db.js";

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";
const SECRET = resolveSecret();

/** Production must set JWT_SECRET; local dev gets a fixed fallback. */
function resolveSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return "dev-secret-change-me";
}

/** Short-lived token used for API access (role + email in payload). */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

/** Long-lived token used only to mint a new access token. */
export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: "refresh" }, SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });
}

/** Throws if the token is missing, forged, or expired. */
export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

/** Store hashes only — never persist raw refresh tokens. */
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Insert refresh token hash so we can revoke / rotate later. */
export async function storeRefreshToken(userId, refreshToken) {
  const decoded = jwt.decode(refreshToken);
  const expiresAt = new Date(decoded.exp * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashToken(refreshToken), expiresAt]
  );
}

/** Delete one refresh token (logout or rotation). */
export async function revokeRefreshToken(refreshToken) {
  await query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [
    hashToken(refreshToken),
  ]);
}

/** Kill every refresh session for a user (password change, demotion, logout-all). */
export async function revokeAllRefreshTokens(userId) {
  if (!userId) return;
  await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
}

/**
 * True only if the hash exists and is not expired.
 * Fail closed: callers must catch DB errors and treat as invalid.
 */
export async function isRefreshValid(refreshToken) {
  const { rows } = await query(
    `SELECT 1 FROM refresh_tokens
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [hashToken(refreshToken)]
  );
  return rows.length > 0;
}
