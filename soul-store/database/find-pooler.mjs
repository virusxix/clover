import pg from "pg";

const password = "cloverabcdb1234";
const projectRef = "oxcuxupqudvmsrqoutqr";
const regions = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1", "eu-north-1",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
  "ap-northeast-2", "ca-central-1", "sa-east-1",
];

for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const pool = new pg.Pool({
    host,
    user: `postgres.${projectRef}`,
    password,
    database: "postgres",
    port: 5432,
    ssl: { rejectUnauthorized: false, servername: host },
    connectionTimeoutMillis: 6000,
  });
  try {
    await pool.query("SELECT 1");
    console.log("SUCCESS", region);
    await pool.end();
    process.exit(0);
  } catch (e) {
    const msg = String(e.message).split("\n")[0].slice(0, 80);
    console.log(region, e.code, msg);
  }
  await pool.end().catch(() => {});
}
