import pg from "pg";

const password = process.env.DB_PASSWORD || "cloverabcdb1234";
const projectRef = "oxcuxupqudvmsrqoutqr";

const regions = [
  "us-east-1", "us-east-2", "us-west-1", "eu-west-1", "eu-central-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "sa-east-1",
];

const attempts = [
  { label: "direct", host: `db.${projectRef}.supabase.co`, user: "postgres", port: 5432 },
];

for (const region of regions) {
  for (const prefix of ["aws-0", "aws-1"]) {
    for (const user of [`postgres.${projectRef}`, "postgres"]) {
      for (const port of [5432, 6543]) {
        attempts.push({
          label: `${prefix}-${region}-${user.split(".")[0]}-${port}`,
          host: `${prefix}-${region}.pooler.supabase.com`,
          user,
          port,
        });
      }
    }
  }
}

for (const cfg of attempts) {
  const pool = new pg.Pool({
    host: cfg.host,
    user: cfg.user,
    password,
    database: "postgres",
    port: cfg.port,
    ssl: { rejectUnauthorized: false, servername: cfg.host },
    connectionTimeoutMillis: 10000,
  });
  try {
    const { rows } = await pool.query("SELECT 1 AS ok");
    console.log(`OK [${cfg.label}]`, cfg.host, cfg.port, rows);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.log(`FAIL [${cfg.label}]`, err.code || err.message, err.message?.slice?.(0, 120));
    await pool.end().catch(() => {});
  }
}
process.exit(1);
