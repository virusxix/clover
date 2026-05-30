import pg from "pg";
import { resolveHost } from "./resolve-host.mjs";

const POOLER_REGIONS = [
  "ap-northeast-2", "ap-northeast-1", "ap-southeast-1", "ap-southeast-2", "ap-south-1",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1",
];

function parseUrl(connectionString) {
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

function poolFromParts({ host, port, user, password, database, servername }) {
  return new pg.Pool({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false, servername: servername || host },
    connectionTimeoutMillis: 15000,
    max: 5,
  });
}

/** Connect using DATABASE_URL (pooler URI recommended for Supabase). */
export async function createPool(connectionString = process.env.DATABASE_URL) {
  const cfg = parseUrl(connectionString);
  const errors = [];

  // Use pooler URL directly when provided
  if (cfg.isPooler) {
    const pool = poolFromParts({
      host: cfg.hostname,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      servername: cfg.hostname,
    });
    await pool.query("SELECT 1");
    console.log(`[db] Connected via ${cfg.hostname}`);
    return pool;
  }

  // Direct host (IPv6 via Windows DNS)
  const directIp = resolveHost(cfg.hostname);
  if (directIp && directIp !== cfg.hostname) {
    try {
      const pool = poolFromParts({
        host: directIp,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        servername: cfg.hostname,
      });
      await pool.query("SELECT 1");
      console.log("[db] Connected via direct IPv6");
      return pool;
    } catch (err) {
      errors.push(`direct: ${err.code || err.message}`);
    }
  }

  // Auto-discover pooler (aws-0 and aws-1)
  if (cfg.projectRef) {
    for (const prefix of ["aws-1", "aws-0"]) {
      for (const region of POOLER_REGIONS) {
        const poolerHost = `${prefix}-${region}.pooler.supabase.com`;
        const poolerUser = cfg.user.startsWith("postgres.") ? cfg.user : `postgres.${cfg.projectRef}`;
        try {
          const pool = poolFromParts({
            host: poolerHost,
            port: 5432,
            user: poolerUser,
            password: cfg.password,
            database: cfg.database,
            servername: poolerHost,
          });
          await pool.query("SELECT 1");
          console.log(`[db] Connected via ${poolerHost}`);
          return pool;
        } catch (err) {
          errors.push(`${poolerHost}: ${(err.message || "").split("\n")[0].slice(0, 50)}`);
        }
      }
    }
  }

  throw new Error(
    `Could not connect to Supabase.\n${errors.slice(0, 6).join("\n")}\n\n` +
      "Set DATABASE_URL to the Session pooler URI from Supabase → Database settings."
  );
}
