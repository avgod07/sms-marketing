import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function resetDatabase() {
  try {
    console.log("Dropping all tables...");

    // Get all table names
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'drizzle_%'
    `);

    const tables = result.rows;

    if (tables.length > 0) {
      // Drop all tables
      const tableNames = tables.map((t) => t.tablename).join(", ");
      await pool.query(`DROP TABLE IF EXISTS ${tableNames} CASCADE`);
      console.log(`Dropped ${tables.length} tables: ${tableNames}`);
    } else {
      console.log("No tables to drop");
    }

    console.log("Database reset complete");
  } catch (error) {
    console.error("Error resetting database:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase();
