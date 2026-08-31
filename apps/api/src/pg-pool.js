/**
 * PostgreSQL pool
 * ---------------
 * One job: open (and cache) a pg.Pool from DATABASE_URL.
 * Prefers Supabase session pooler; falls back to DNS / region discovery.
 */

import dns from "dns/promises";
import pg from "pg";

const POOLER_REGIONS = [
  "ap-northeast-2",
  "ap-northeast-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "us-east-1",
  "us-west-1",
  "eu-west-2",
];

let cachedPool = null;

/** Return the shared pool (connects on first use). */
export async function getPool() {
  if (cachedPool) return cachedPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const cfg = parseDatabaseUrl(connectionString);
  cachedPool = await connectWithConfig(cfg);
  return cachedPool;
}

/** Run a query on the shared pool. */
export async function query(text, params) {
  const pool = await getPool();
  return pool.query(text, params);
}

/** Pull user / host / db fields out of a postgres:// URI. */
function parseDatabaseUrl(connectionString) {
  const url = new URL(connectionString);
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || "postgres",
    port: Number(url.port) || 5432,
    hostname: url.hostname,
    projectRef:
      url.hostname.match(/db\.([^.]+)\.supabase/)?.[1] ||
      url.username.match(/^postgres\.(.+)$/)?.[1],
    isPooler: url.hostname.includes("pooler.supabase.com"),
  };
}

/**
 * Try pooler URI first, then direct IP, then scan common pooler regions.
 */
async function connectWithConfig(cfg) {
  if (cfg.isPooler) {
    return tryPool({
      host: cfg.hostname,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      servername: cfg.hostname,
      label: cfg.hostname,
    });
  }

  const directIp = await resolveHostIp(cfg.hostname);
  if (directIp && directIp !== cfg.hostname) {
    try {
      return await tryPool({
        host: directIp,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        servername: cfg.hostname,
        label: `${cfg.hostname} via ${directIp}`,
      });
    } catch {
      // Fall through to pooler discovery.
    }
  }

  if (cfg.projectRef) {
    for (const prefix of ["aws-1", "aws-0"]) {
      for (const region of POOLER_REGIONS) {
        const poolerHost = `${prefix}-${region}.pooler.supabase.com`;
        try {
          return await tryPool({
            host: poolerHost,
            port: 5432,
            user: `postgres.${cfg.projectRef}`,
            password: cfg.password,
            database: cfg.database,
            servername: poolerHost,
            label: poolerHost,
          });
        } catch {
          // Try next region.
        }
      }
    }
  }

  throw new Error(
    "Database connection failed. Set DATABASE_URL to the Supabase Session pooler URI."
  );
}

/** Create a pool and prove it with SELECT 1. */
async function tryPool({ host, port, user, password, database, servername, label }) {
  const pool = makePool({ host, port, user, password, database, servername });
  await pool.query("SELECT 1");
  console.log(`[api] DB connected: ${label}`);
  return pool;
}

/** Build a small pg.Pool with SSL settings suitable for Supabase. */
function makePool({ host, port, user, password, database, servername }) {
  const hostName = servername || host;
  return new pg.Pool({
    host,
    port,
    user,
    password,
    database,
    max: 5,
    ssl: {
      rejectUnauthorized: shouldVerifySsl(hostName),
      servername: hostName,
    },
    connectionTimeoutMillis: 15000,
  });
}

/**
 * Supabase pooler often needs lenient SSL by default.
 * Override with PG_SSL_REJECT_UNAUTHORIZED=true|false.
 */
function shouldVerifySsl(hostName) {
  if (process.env.PG_SSL_REJECT_UNAUTHORIZED === "true") return true;
  if (process.env.PG_SSL_REJECT_UNAUTHORIZED === "false") return false;
  return !String(hostName).includes("supabase");
}

/** Resolve hostname to an IP (IPv4 first, then IPv6). */
async function resolveHostIp(hostname) {
  try {
    const { address } = await dns.lookup(hostname, { family: 4 });
    return address || hostname;
  } catch {
    try {
      const { address } = await dns.lookup(hostname, { family: 6 });
      return address || hostname;
    } catch {
      return hostname;
    }
  }
}
