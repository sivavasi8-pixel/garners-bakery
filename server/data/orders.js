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
    deliveryType: row.delivery_type,
    deliveryZone: row.delivery_zone,
    deliveryAddress: row.delivery_address,
    deliveryFee: row.delivery_fee === null ? null : Number(row.delivery_fee),
    createdAt: row.created_at
  };

module.exports = {
  getAll: async () => {
    const { rows } = await pool.query("select * from orders order by id desc");
    return rows.map(mapRow);
  },
  // `forUpdate` locks the row for the rest of the caller's transaction, so two
  // simultaneous cancel/status requests can't both act on the same old state.
  getById: async (id, db = pool, { forUpdate = false } = {}) => {
    const { rows } = await db.query(`select * from orders where id = $1${forUpdate ? " for update" : ""}`, [
      Number(id)
    ]);
    return mapRow(rows[0]);
  },
  getByCustomerId: async (customerId) => {
    const { rows } = await pool.query("select * from orders where customer_id = $1 order by id desc", [
      Number(customerId)
    ]);
    return rows.map(mapRow);
  },
  // Only orders created "today" in India time — the bakery's day, not the database
  // server's (Neon runs on UTC, which would put 12:00–5:30 AM IST orders on the wrong day).
  getToday: async () => {
    const { rows } = await pool.query(
      `select * from orders
       where (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
       order by id desc`
    );
    return rows.map(mapRow);
  },
  create: async ({
    customerName,
    customerId,
    items,
    total,
    pickupTime,
    channel,
    paymentMethod,
    paymentStatus,
    deliveryType,
    deliveryZone,
    deliveryAddress,
    deliveryFee
  }, db = pool) => {
    const { rows } = await db.query(
      `insert into orders (
         customer_name, customer_id, items, total, pickup_time, channel, payment_method, payment_status,
         delivery_type, delivery_zone, delivery_address, delivery_fee
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning *`,
      [
        customerName,
        customerId,
        JSON.stringify(items),
        total || 0,
        pickupTime,
        channel || "online",
        paymentMethod || null,
        paymentStatus || "unpaid",
        deliveryType || "pickup",
        deliveryZone || null,
        deliveryAddress || null,
        deliveryFee === undefined ? null : deliveryFee
      ]
    );
    return mapRow(rows[0]);
  },
  updateStatus: async (id, status, db = pool) => {
    const { rows } = await db.query("update orders set status = $1 where id = $2 returning *", [
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
