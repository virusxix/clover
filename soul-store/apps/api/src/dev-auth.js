/**
 * Local dev auth when PostgreSQL is unreachable.
 * Set DEV_AUTH_FALLBACK=false in production.
 */
import bcrypt from "bcryptjs";

const ENABLED =
  process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_FALLBACK !== "false";

const USERS = [];

let ready = false;

async function init() {
  if (ready) return;
  const adminHash = await bcrypt.hash("Admin123!", 12);
  USERS.push(
    {
      id: "dev-admin-001",
      email: "admin@clover.com",
      password_hash: adminHash,
      full_name: "Clover Admin",
      role: "admin",
    },
    {
      id: "dev-admin-002",
      email: "admin@soul.com",
      password_hash: adminHash,
      full_name: "Clover Admin",
      role: "admin",
    },
    {
      id: "dev-demo-001",
      email: "demo@clover.com",
      password_hash: await bcrypt.hash("Demo1234!", 12),
      full_name: "Demo Customer",
      role: "customer",
    }
  );
  ready = true;
}

export function isDevAuthEnabled() {
  return ENABLED;
}

export async function devFindUserByEmail(email) {
  if (!ENABLED) return null;
  await init();
  return USERS.find((u) => u.email === email.toLowerCase()) || null;
}

export async function devFindUserById(id) {
  if (!ENABLED) return null;
  await init();
  return USERS.find((u) => u.id === id) || null;
}

export async function devVerifyLogin(email, password) {
  const user = await devFindUserByEmail(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? user : null;
}

export async function devCreateUser(email, password, fullName) {
  if (!ENABLED) return null;
  await init();
  if (USERS.some((u) => u.email === email.toLowerCase())) {
    throw new Error("EMAIL_EXISTS");
  }
  const user = {
    id: `dev-${Date.now()}`,
    email: email.toLowerCase(),
    password_hash: await bcrypt.hash(password, 12),
    full_name: fullName,
    role: "customer",
  };
  USERS.push(user);
  return user;
}

export function devUserDto(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  };
}
