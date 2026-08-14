// Users, backed by PostgreSQL — see server/db/schema.sql for the table + seed data.
const pool = require("../config/db");

const mapRow = (row) =>
  row && {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    staffId: row.staff_id
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
  createCustomer: async ({ name, email, passwordHash }) => {
    const { rows } = await pool.query(
      `insert into users (name, email, password_hash, role)
       values ($1, $2, $3, 'customer') returning *`,
      [name, email, passwordHash]
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
  }
};
