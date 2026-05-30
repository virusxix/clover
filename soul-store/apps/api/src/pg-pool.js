/**
 * Supabase-aware PostgreSQL pool
 */
import pg from "pg";
import { execSync } from "child_process";

const POOLER_REGIONS = [
  "ap-northeast-2", "ap-northeast-1", "ap-southeast-1", "ap-southeast-2",
  "us-east-1", "us-west-1", "eu-west-2",
];

function resolveHost(hostname) {
  try {
    const cmd = `powershell -NoProfile -Command "(Resolve-DnsName -Name '${hostname}' -Type AAAA -ErrorAction Stop | Select-Object -First 1 -ExpandProperty IPAddress)"`;
    return execSync(cmd, { encoding: "utf8" }).trim() || hostname;
  } catch {
    return hostname;
  }
}

function makePool({ host, port, user, password, database, servername }) {
  return new pg.Pool({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false, servername: servername || host },
    connectionTimeoutMillis: 15000,
  });
}

let cachedPool = null;

export async function getPool() {
  if (cachedPool) return cachedPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const url = new URL(connectionString);
  const cfg = {
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

  if (cfg.isPooler) {
    const pool = makePool({
      host: cfg.hostname,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      servername: cfg.hostname,
    });
    await pool.query("SELECT 1");
    console.log(`[api] DB connected: ${cfg.hostname}`);
    cachedPool = pool;
    return pool;
  }

  const directIp = resolveHost(cfg.hostname);
  if (directIp && directIp !== cfg.hostname) {
    try {
      const pool = makePool({
        host: directIp,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        servername: cfg.hostname,
      });
      await pool.query("SELECT 1");
      cachedPool = pool;
      return pool;
    } catch {
      /* try pooler */
    }
  }

  if (cfg.projectRef) {
    for (const prefix of ["aws-1", "aws-0"]) {
      for (const region of POOLER_REGIONS) {
        const poolerHost = `${prefix}-${region}.pooler.supabase.com`;
        try {
          const pool = makePool({
            host: poolerHost,
            port: 5432,
            user: `postgres.${cfg.projectRef}`,
            password: cfg.password,
            database: cfg.database,
            servername: poolerHost,
          });
          await pool.query("SELECT 1");
          console.log(`[api] DB via ${poolerHost}`);
          cachedPool = pool;
          return pool;
        } catch {
          /* next */
        }
      }
    }
  }

  throw new Error(
    "Database connection failed. Set DATABASE_URL to the Supabase Session pooler URI."
  );
}

export async function query(text, params) {
  const pool = await getPool();
  return pool.query(text, params);
}
