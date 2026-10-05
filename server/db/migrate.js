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
  "create index if not exists idx_push_tokens_user_id on push_tokens(user_id)",
  // A customer's saved delivery addresses — like any ecommerce checkout's address
  // book. One is marked default (addressController enforces only one per user);
  // lat/lng are set when the address came from "use my current location" rather
  // than typed by hand.
  `create table if not exists customer_addresses (
     id serial primary key,
     user_id integer not null references users(id) on delete cascade,
     label text not null default 'Home',
     address text not null,
     phone text,
     lat numeric,
     lng numeric,
     is_default boolean not null default false,
     created_at timestamptz not null default now()
   )`,
  "create index if not exists idx_customer_addresses_user_id on customer_addresses(user_id)",
  // The precise coordinates when a delivery order was placed with "use my
  // current location" instead of (or in addition to) a saved address — lets
  // staff open the exact drop point in Maps instead of relying on the typed
  // address alone. Null for pickup orders and for addresses typed by hand.
  "alter table orders add column if not exists delivery_lat numeric",
  "alter table orders add column if not exists delivery_lng numeric",
  // Delivery-partner accounts — a new login role alongside owner/staff/customer.
  // Drop+recreate (not ALTER ... ADD VALUE, which doesn't exist for a plain CHECK
  // constraint) is safe to repeat every boot since it's the same definition each time.
  "alter table users drop constraint if exists users_role_check",
  "alter table users add constraint users_role_check check (role in ('owner', 'staff', 'customer', 'delivery'))",
  // Which delivery partner has claimed this order, and when — claiming is an
  // atomic "only if still unclaimed" update (see data/orders.js claim()), so two
  // agents racing for the same order can't both win it.
  "alter table orders add column if not exists delivery_agent_id integer references users(id)",
  "alter table orders add column if not exists claimed_at timestamptz"
];

async function migrate() {
  if (!pool) return;
  for (const sql of MIGRATIONS) await pool.query(sql);
}

module.exports = { migrate };
