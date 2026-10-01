// Small, idempotent schema updates applied at startup, so a deploy brings an
// existing database (e.g. your Neon instance) up to date without anyone pasting
// SQL by hand. Every statement must be safe to run again on every boot.
// New databases get the same columns from db/schema.sql.
const pool = require("../config/db");

const MIGRATIONS = [
  // Phone numbers: on customer accounts (asked at signup) and on each order.
  "alter table users add column if not exists phone text",
  "alter table orders add column if not exists customer_phone text",
  // The booked pickup/delivery day.
  "alter table orders add column if not exists pickup_date date"
];

async function migrate() {
  if (!pool) return;
  for (const sql of MIGRATIONS) await pool.query(sql);
}

module.exports = { migrate };
