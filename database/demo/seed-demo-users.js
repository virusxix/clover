/**
 * Demo login accounts — delete with the rest of database/demo/ for real launch.
 */
import bcrypt from "bcryptjs";

export const DEMO_USERS = [
  { email: "admin@clover.com", password: "Admin123!", fullName: "Clover Admin", role: "admin" },
  { email: "demo@clover.com", password: "Demo1234!", fullName: "Demo Customer", role: "customer" },
];

/**
 * @param {(text: string, params?: unknown[]) => Promise<{ rows: any[] }>} query
 */
export async function runDemoUsersSeed(query) {
  const allow =
    process.env.SEED_DEMO_USERS === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_USERS !== "false");

  if (!allow) {
    console.log("[demo] Skipping demo users (production — set SEED_DEMO_USERS=true to override)");
    return;
  }

  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(u.password, 12);
    await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1,$2,$3,$4::user_role) ON CONFLICT (email) DO NOTHING`,
      [u.email, hash, u.fullName, u.role]
    );
  }
  console.log("[demo] Demo users seeded (admin@clover.com / demo@clover.com)");
}
