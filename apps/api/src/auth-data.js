/**
 * Auth data access
 * ----------------
 * One job: read/write users (Postgres, or in-memory dev fallback).
 * Does not issue JWTs or cookies — see auth-session.js for that.
 */

import { query } from "./db.js";
import { getPool } from "./pg-pool.js";
import {
  isDevAuthEnabled,
  devVerifyLogin,
  devFindUserById,
  devCreateUser,
  devUserDto,
} from "./dev-auth.js";

/** Cached DB ping result so we do not reconnect-spam on every request. */
let dbAvailable = null;
let dbCheckedAt = 0;
const DB_CHECK_TTL_MS = 15_000;

/** Force the next checkDb() to hit Postgres again. */
export function resetDbCheck() {
  dbAvailable = null;
  dbCheckedAt = 0;
}

/**
 * True when we can talk to Postgres.
 * Result is cached briefly; failures are re-tried after TTL.
 */
export async function checkDb() {
  const now = Date.now();
  if (dbAvailable !== null && now - dbCheckedAt < DB_CHECK_TTL_MS) {
    return dbAvailable;
  }

  try {
    const pool = await getPool();
    await pool.query("SELECT 1");
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    if (isDevAuthEnabled()) {
      console.warn("[auth] Database unavailable — using local DEV_AUTH_FALLBACK");
    }
  }

  dbCheckedAt = now;
  return dbAvailable;
}

/** Verify email + password. Returns user row or null. */
export async function verifyLogin(email, password) {
  if (await checkDb()) {
    const { rows } = await query(
      `SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    if (!rows.length) return null;

    const { comparePassword } = await import("./utils/password.js");
    const ok = await comparePassword(password, rows[0].password_hash);
    return ok ? rows[0] : null;
  }

  if (isDevAuthEnabled()) return devVerifyLogin(email, password);
  throw new Error("DATABASE_UNAVAILABLE");
}

/** Create a customer user. Returns null if email already exists. */
export async function createUser(email, password, fullName) {
  if (await checkDb()) {
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [
      email.toLowerCase(),
    ]);
    if (existing.rows.length) return null;

    const { hashPassword } = await import("./utils/password.js");
    const passwordHash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, role`,
      [email.toLowerCase(), passwordHash, fullName]
    );
    return rows[0];
  }

  if (isDevAuthEnabled()) {
    try {
      return await devCreateUser(email, password, fullName);
    } catch (e) {
      if (e.message === "EMAIL_EXISTS") return null;
      throw e;
    }
  }

  throw new Error("DATABASE_UNAVAILABLE");
}

/**
 * Load a user by id.
 * Pass { withPassword: true } when checking / changing passwords.
 */
export async function getUserById(id, { withPassword = false } = {}) {
  if (await checkDb()) {
    const cols = withPassword
      ? `id, email, password_hash, full_name, role, phone, avatar_url, created_at`
      : `id, email, full_name, role, phone, avatar_url, created_at`;
    const { rows } = await query(`SELECT ${cols} FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  if (isDevAuthEnabled()) return devFindUserById(id);
  throw new Error("DATABASE_UNAVAILABLE");
}

/** Shape a DB/dev user into the public API user object. */
export function toUserResponse(user) {
  if (!user) return null;

  if (isDevAuthEnabled() && String(user.id).startsWith("dev-")) {
    return devUserDto(user);
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    phone: user.phone ?? null,
    avatarUrl: user.avatar_url ?? null,
    createdAt: user.created_at,
  };
}

/** Map internal errors to a safe client-facing string. */
export function authErrorMessage(err) {
  if (err.message === "DATABASE_UNAVAILABLE") {
    return "Database is unavailable. Check DATABASE_URL or enable dev mode.";
  }
  return "Authentication failed";
}
