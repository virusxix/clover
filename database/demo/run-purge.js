/**
 * Wipe demo analytics data from the live DB (keeps catalog).
 */
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createPool } from "../pg-config.mjs";
import { purgeDemoData } from "./purge-demo.js";

dns.setDefaultResultOrder("ipv6first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../apps/api/.env") });

let pool;
try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (apps/api/.env)");
  }
  pool = await createPool(process.env.DATABASE_URL);
  await purgeDemoData((text, params) => pool.query(text, params));
  console.log("Demo purge completed.");
} catch (err) {
  console.error("Demo purge failed:", err.message);
  process.exit(1);
} finally {
  if (pool) await pool.end();
}
