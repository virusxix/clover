/**
 * PostgreSQL — delegates to Supabase-aware pool
 */
import dns from "dns";
import dotenv from "dotenv";
import { getPool, query as pgQuery } from "./pg-pool.js";

dns.setDefaultResultOrder("ipv6first");
dotenv.config();

export const pool = {
  connect: async () => {
    const p = await getPool();
    return p.connect();
  },
};

export async function query(text, params) {
  const start = Date.now();
  const res = await pgQuery(text, params);
  if (process.env.NODE_ENV === "development") {
    const duration = Date.now() - start;
    if (duration > 200) console.log("[db slow]", { text: text.slice(0, 60), duration });
  }
  return res;
}
