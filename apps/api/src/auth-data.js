/**
 * Auth data layer — PostgreSQL with dev fallback when DB is down.
 */
import { query } from "./db.js";
import { getPool } from "./pg-pool.js";
import {
  isDevAuthEnabled,
  devVerifyLogin,
  devFindUserByEmail,
  devFindUserById,
  devCreateUser,
  devUserDto,
} from "./dev-auth.js";

let dbAvailable = null;

/** Reset after DATABASE_URL change (e.g. pooler configured) */
export function resetDbCheck() {
  dbAvailable = null;
}

export async function checkDb() {
  if (dbAvailable !== null) return dbAvailable;
  try {
    await getPool();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    if (isDevAuthEnabled()) {
      console.warn("[auth] Database unavailable — using DEV_AUTH_FALLBACK (admin@clover.com / Admin123!)");
    }
  }
  return dbAvailable;
}

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

export async function createUser(email, password, fullName) {
  if (await checkDb()) {
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
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

export async function getUserById(id) {
  if (await checkDb()) {
    const { rows } = await query(
      `SELECT id, email, full_name, role, phone, avatar_url, created_at FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }
  if (isDevAuthEnabled()) return devFindUserById(id);
  throw new Error("DATABASE_UNAVAILABLE");
}

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

export function authErrorMessage(err) {
  if (err.message === "DATABASE_UNAVAILABLE") {
    return "Database is unavailable. Check DATABASE_URL or enable dev mode.";
  }
  return "Authentication failed";
}
