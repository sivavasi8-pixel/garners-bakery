// PostgreSQL connection pool. Falls back to `null` when DATABASE_URL isn't set,
// so the mock in-memory data in server/data/*.js keeps working until a real
// database is connected — see README.md > "Connecting a real PostgreSQL database".
const { Pool } = require("pg");

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon/Supabase free-tier Postgres both require TLS; rejectUnauthorized:false
      // is standard for their managed certs (not a real security downgrade here).
      ssl: { rejectUnauthorized: false }
    })
  : null;

module.exports = pool;
