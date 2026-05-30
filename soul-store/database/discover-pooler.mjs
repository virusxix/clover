import pg from "pg";

const password = "cloverabcdb1234";
const projectRef = "oxcuxupqudvmsrqoutqr";

const regions = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1", "eu-north-1",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "ca-central-1", "sa-east-1",
];

for (const prefix of ["aws-0", "aws-1"]) {
  for (const region of regions) {
    for (const port of [5432, 6543]) {
      for (const user of [`postgres.${projectRef}`, "postgres"]) {
        const host = `${prefix}-${region}.pooler.supabase.com`;
        const pool = new pg.Pool({
          host,
          port,
          user,
          password,
          database: "postgres",
          ssl: { rejectUnauthorized: false, servername: host },
          connectionTimeoutMillis: 8000,
        });
        try {
          await pool.query("SELECT 1 AS ok");
          const uri = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
          console.log("SUCCESS", { prefix, region, port, user });
          console.log("DATABASE_URL=" + uri);
          await pool.end();
          process.exit(0);
        } catch (e) {
          const msg = (e.message || "").split("\n")[0];
          if (!msg.includes("ENOTFOUND") && !msg.includes("Tenant or user not found")) {
            console.log("?", prefix, region, port, user, msg.slice(0, 80));
          }
        }
        await pool.end().catch(() => {});
      }
    }
  }
}

// Direct db host ports
for (const port of [5432, 6543]) {
  const host = `db.${projectRef}.supabase.co`;
  const pool = new pg.Pool({
    connectionString: `postgresql://postgres:${password}@${host}:${port}/postgres`,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await pool.query("SELECT 1");
    console.log("SUCCESS direct", port);
    process.exit(0);
  } catch (e) {
    console.log("direct", port, e.code || e.message?.split("\n")[0]);
  }
  await pool.end().catch(() => {});
}

console.log("No working connection found");
process.exit(1);
