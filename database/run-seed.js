import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { runSeed } from "./seed.js";
import { createPool } from "./pg-config.mjs";

dns.setDefaultResultOrder("ipv6first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../apps/api/.env") });

let pool;
try {
  pool = await createPool(process.env.DATABASE_URL);
  await runSeed((text, params) => pool.query(text, params));
  console.log("Catalog seed completed.");
} catch (err) {
  console.error("Seed failed:", err.message);
  process.exit(1);
} finally {
  if (pool) await pool.end();
}
