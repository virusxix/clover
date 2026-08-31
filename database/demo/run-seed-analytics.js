/**
 * Run demo analytics seed (website + store + ICONIC sales history).
 * Part of database/demo/ — safe to delete that folder for production.
 */
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createPool } from "../pg-config.mjs";
import { runAnalyticsSeed } from "./seed-analytics.js";

dns.setDefaultResultOrder("ipv6first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../apps/api/.env") });

let pool;
try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (apps/api/.env)");
  }
  pool = await createPool(process.env.DATABASE_URL);
  await runAnalyticsSeed((text, params) => pool.query(text, params));
  console.log("Analytics demo seed completed.");
  console.log("Open Admin → Analytics to see daily/weekly/monthly/yearly P&L.");
} catch (err) {
  console.error("Analytics seed failed:", err.message);
  process.exit(1);
} finally {
  if (pool) await pool.end();
}
