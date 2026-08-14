// Orders, backed by PostgreSQL — see server/db/schema.sql.
const pool = require("../config/db");

const mapRow = (row) =>
  row && {
    id: row.id,
    customerName: row.customer_name,
    customerId: row.customer_id,
    items: row.items,
    status: row.status,
    total: Number(row.total),
    pickupTime: row.pickup_time,
    channel: row.channel,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    createdAt: row.created_at
  };

module.exports = {
  getAll: async () => {
    const { rows } = await pool.query("select * from orders order by id desc");
    return rows.map(mapRow);
  },
  getById: async (id) => {
    const { rows } = await pool.query("select * from orders where id = $1", [Number(id)]);
    return mapRow(rows[0]);
  },
  getByCustomerId: async (customerId) => {
    const { rows } = await pool.query("select * from orders where customer_id = $1 order by id desc", [
      Number(customerId)
    ]);
    return rows.map(mapRow);
  },
  // Only orders created today (server's clock/timezone) — used for the dashboard's
  // "today's revenue" and "orders today" stats, which previously summed all orders ever.
  getToday: async () => {
    const { rows } = await pool.query(
      `select * from orders
       where created_at >= date_trunc('day', now()) and created_at < date_trunc('day', now()) + interval '1 day'
       order by id desc`
    );
    return rows.map(mapRow);
  },
  create: async ({ customerName, customerId, items, total, pickupTime, channel, paymentMethod, paymentStatus }) => {
    const { rows } = await pool.query(
      `insert into orders (customer_name, customer_id, items, total, pickup_time, channel, payment_method, payment_status)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [
        customerName,
        customerId,
        JSON.stringify(items),
        total || 0,
        pickupTime,
        channel || "online",
        paymentMethod || null,
        paymentStatus || "unpaid"
      ]
    );
    return mapRow(rows[0]);
  },
  updateStatus: async (id, status) => {
    const { rows } = await pool.query("update orders set status = $1 where id = $2 returning *", [
      status,
      Number(id)
    ]);
    return mapRow(rows[0]);
  },
  updatePaymentStatus: async (id, paymentStatus) => {
    const { rows } = await pool.query("update orders set payment_status = $1 where id = $2 returning *", [
      paymentStatus,
      Number(id)
    ]);
    return mapRow(rows[0]);
  },
  updatePickupTime: async (id, pickupTime) => {
    const { rows } = await pool.query("update orders set pickup_time = $1 where id = $2 returning *", [
      pickupTime,
      Number(id)
    ]);
    return mapRow(rows[0]);
  }
};
