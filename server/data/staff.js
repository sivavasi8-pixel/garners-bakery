// Staff roster + task assignments, backed by PostgreSQL — see server/db/schema.sql.
const pool = require("../config/db");

const mapTask = (row) =>
  row && {
    id: row.id,
    description: row.description,
    assignedTo: row.assigned_to,
    due: row.due,
    done: row.done
  };

module.exports = {
  getAll: async () => {
    const { rows } = await pool.query("select * from staff order by id");
    return rows;
  },
  getById: async (id) => {
    const { rows } = await pool.query("select * from staff where id = $1", [Number(id)]);
    return rows[0];
  },
  getTasks: async () => {
    const { rows } = await pool.query("select * from staff_tasks order by id");
    return rows.map(mapTask);
  },
  updateStatus: async (id, status) => {
    const { rows } = await pool.query("update staff set status = $1 where id = $2 returning *", [
      status,
      Number(id)
    ]);
    return rows[0];
  },
  updateShift: async (id, shift) => {
    const { rows } = await pool.query("update staff set shift = $1 where id = $2 returning *", [
      shift,
      Number(id)
    ]);
    return rows[0];
  },
  create: async ({ name, role, shift }) => {
    const { rows } = await pool.query(
      "insert into staff (name, role, shift, status) values ($1, $2, $3, 'clocked_out') returning *",
      [name, role, shift]
    );
    return rows[0];
  },
  // Also removes any login account tied to this roster row — a dangling "staff" account
  // with no roster presence would be confusing (shows up nowhere, but can still log in).
  remove: async (id) => {
    await pool.query("delete from users where staff_id = $1", [Number(id)]);
    const { rowCount } = await pool.query("delete from staff where id = $1", [Number(id)]);
    return rowCount > 0;
  },
  createTask: async ({ description, assignedTo, due }) => {
    const { rows } = await pool.query(
      "insert into staff_tasks (description, assigned_to, due) values ($1, $2, $3) returning *",
      [description, assignedTo, due]
    );
    return mapTask(rows[0]);
  },
  // Partial update — any omitted field keeps its current value (mirrors inventory.update).
  updateTask: async (id, { description, assignedTo, due, done }) => {
    const { rows } = await pool.query(
      `update staff_tasks set
         description = coalesce($1, description),
         assigned_to = coalesce($2, assigned_to),
         due = coalesce($3, due),
         done = coalesce($4, done)
       where id = $5 returning *`,
      [description ?? null, assignedTo ?? null, due ?? null, done ?? null, Number(id)]
    );
    return mapTask(rows[0]);
  },
  deleteTask: async (id) => {
    const { rowCount } = await pool.query("delete from staff_tasks where id = $1", [Number(id)]);
    return rowCount > 0;
  }
};
