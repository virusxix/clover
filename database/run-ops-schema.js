/**
 * Apply ops schema (inventory, store POS, ICONIC).
 * Safe to re-run. Requires base schema already applied.
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

const sql = fs.readFileSync(path.join(__dirname, "ops-schema.sql"), "utf8");

let pool;
try {
  pool = await createPool(process.env.DATABASE_URL);
  await pool.query(sql);
  console.log("Ops schema applied successfully.");
} catch (err) {
  console.error("Ops schema failed:", err.message);
  process.exit(1);
} finally {
  if (pool) await pool.end();
}
