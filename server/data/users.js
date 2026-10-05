// Users, backed by PostgreSQL — see server/db/schema.sql for the table + seed data.
const pool = require("../config/db");

const mapRow = (row) =>
  row && {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    staffId: row.staff_id,
    phone: row.phone,
    pinHash: row.pin_hash,
    pinResetRequestedAt: row.pin_reset_requested_at
  };

module.exports = {
  findByEmail: async (email) => {
    const { rows } = await pool.query("select * from users where lower(email) = lower($1)", [email]);
    return mapRow(rows[0]);
  },
  findById: async (id) => {
    const { rows } = await pool.query("select * from users where id = $1", [Number(id)]);
    return mapRow(rows[0]);
  },
  createCustomer: async ({ name, email, passwordHash, phone, pinHash }) => {
    const { rows } = await pool.query(
      `insert into users (name, email, password_hash, role, phone, pin_hash)
       values ($1, $2, $3, 'customer', $4, $5) returning *`,
      [name, email, passwordHash, phone || null, pinHash || null]
    );
    return mapRow(rows[0]);
  },
  // Owner-only path (see staffController.createStaffMember) — staff/owner accounts
  // are never self-served, unlike customer signup.
  createStaffAccount: async ({ name, email, passwordHash, staffId }) => {
    const { rows } = await pool.query(
      `insert into users (name, email, password_hash, role, staff_id)
       values ($1, $2, $3, 'staff', $4) returning *`,
      [name, email, passwordHash, staffId]
    );
    return mapRow(rows[0]);
  },
  // Self-service password reset: customer supplies email + PIN + new password.
  resetPassword: async (id, newPasswordHash) => {
    const { rows } = await pool.query(
      "update users set password_hash = $1 where id = $2 returning *",
      [newPasswordHash, Number(id)]
    );
    return mapRow(rows[0]);
  },
  // Flag the account so admins can see it in the Customers page and reset the PIN.
  requestPinReset: async (id) => {
    const { rows } = await pool.query(
      "update users set pin_reset_requested_at = now() where id = $1 returning *",
      [Number(id)]
    );
    return mapRow(rows[0]);
  },
  // Admin: set a new PIN (clears the request flag atomically in the same statement).
  adminSetPin: async (id, newPinHash) => {
    const { rows } = await pool.query(
      "update users set pin_hash = $1, pin_reset_requested_at = null where id = $2 returning *",
      [newPinHash, Number(id)]
    );
    return mapRow(rows[0]);
  },
  // Admin: reset a customer's password directly (no PIN involved).
  adminSetPassword: async (id, newPasswordHash) => {
    const { rows } = await pool.query(
      "update users set password_hash = $1 where id = $2 returning *",
      [newPasswordHash, Number(id)]
    );
    return mapRow(rows[0]);
  },
  // All customer accounts — used by the admin Customers page.
  getAllCustomers: async () => {
    const { rows } = await pool.query(
      "select * from users where role = 'customer' order by id asc"
    );
    return rows.map(mapRow);
  },
  // Delivery-partner logins — a new role, not a staff roster entry: no shift or
  // clock-in/out to track, just an account that can claim and deliver orders.
  createDeliveryAccount: async ({ name, email, passwordHash, phone }) => {
    const { rows } = await pool.query(
      `insert into users (name, email, password_hash, role, phone)
       values ($1, $2, $3, 'delivery', $4) returning *`,
      [name, email, passwordHash, phone || null]
    );
    return mapRow(rows[0]);
  },
  getAllDeliveryPartners: async () => {
    const { rows } = await pool.query("select * from users where role = 'delivery' order by id asc");
    return rows.map(mapRow);
  },
  remove: async (id) => {
    const { rowCount } = await pool.query("delete from users where id = $1", [Number(id)]);
    return rowCount > 0;
  }
};

