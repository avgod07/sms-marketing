import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL not set");
}

const client = new pg.Client({ connectionString: url });

async function reset() {
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE;");
  await client.query("CREATE SCHEMA public;");
  await client.end();
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});
