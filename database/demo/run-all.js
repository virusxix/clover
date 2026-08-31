/**
 * Seed everything under database/demo/ (users + analytics sales).
 */
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createPool } from "../pg-config.mjs";
import { runDemoUsersSeed } from "./seed-demo-users.js";
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
  const query = (text, params) => pool.query(text, params);
  await runDemoUsersSeed(query);
  await runAnalyticsSeed(query);
  console.log("Demo seed completed (users + analytics).");
  console.log("Accounts: admin@clover.com / Admin123! | demo@clover.com / Demo1234!");
} catch (err) {
  console.error("Demo seed failed:", err.message);
  process.exit(1);
} finally {
  if (pool) await pool.end();
}
