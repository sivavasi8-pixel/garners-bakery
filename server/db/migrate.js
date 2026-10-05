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
  "alter table orders add column if not exists pickup_date date",
  // Customer PIN — used for self-service password reset (email + PIN + new password).
  // Nullable so existing accounts aren't broken; set at signup going forward.
  "alter table users add column if not exists pin_hash text",
  // Flag set when a customer can't remember their PIN and asks an admin to reset it.
  // Cleared (along with pin_hash) when an admin resets the PIN from the Customers page.
  "alter table users add column if not exists pin_reset_requested_at timestamptz",
  // Push-notification device tokens (Firebase Cloud Messaging) — one row per
  // (user, device). A token is unique across users: re-registering the same
  // browser/device just moves its row to whoever is now logged in there.
  `create table if not exists push_tokens (
     id serial primary key,
     user_id integer not null references users(id) on delete cascade,
     token text not null unique,
     created_at timestamptz not null default now()
   )`,
  "create index if not exists idx_push_tokens_user_id on push_tokens(user_id)"
];

async function migrate() {
  if (!pool) return;
  for (const sql of MIGRATIONS) await pool.query(sql);
}

module.exports = { migrate };
