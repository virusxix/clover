/**
 * Apply RLS lock-down (enable RLS, revoke anon/authenticated table access).
 * Safe to re-run. Does not FORCE RLS — API postgres role continues to work.
 */
import dns from "dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createPool } from "./pg-config.mjs";

dns.setDefaultResultOrder("ipv6first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../apps/api/.env") });

const sql = fs.readFileSync(path.join(__dirname, "rls-schema.sql"), "utf8");

let pool;
try {
  pool = await createPool(process.env.DATABASE_URL);
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT c.relname AS table_name, c.relrowsecurity AS rls_on
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     ORDER BY 1`
  );
  console.log("RLS schema applied. Table status:");
  for (const r of rows) {
    console.log(`  ${r.rls_on ? "ON " : "OFF"}  ${r.table_name}`);
  }
  const off = rows.filter((r) => !r.rls_on);
  if (off.length) {
    console.warn("WARNING: RLS still off on:", off.map((r) => r.table_name).join(", "));
    process.exitCode = 1;
  } else {
    console.log("All public tables have RLS enabled (default deny for anon/authenticated).");
  }
} catch (err) {
  console.error("RLS schema failed:", err.message);
  process.exit(1);
} finally {
  if (pool) await pool.end();
}
