// Orders, backed by PostgreSQL — see server/db/schema.sql.
const pool = require("../config/db");

// Every column except the receipt image itself (up to 5MB) — list queries that
// pulled in `select *` would otherwise drag every unpaid order's receipt photo
// along on every admin board load and every 30s notification poll. A one-off
// lookup of the actual bytes goes through getReceiptImage() instead, same
// pattern as menu photos (data/menuItems.js).
const COLS = `id, customer_name, customer_id, items, total, pickup_time, channel, status, payment_method, payment_status,
  delivery_type, delivery_zone, delivery_address, delivery_fee, delivery_lat, delivery_lng, delivery_agent_id, claimed_at,
  priority, customer_phone, pickup_date, created_at, receipt_mime, receipt_uploaded_at, (receipt_image is not null) as has_receipt`;

const toYmd = (d) =>
  d instanceof Date
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : String(d).slice(0, 10);

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
    deliveryLat: row.delivery_lat === null || row.delivery_lat === undefined ? null : Number(row.delivery_lat),
    deliveryLng: row.delivery_lng === null || row.delivery_lng === undefined ? null : Number(row.delivery_lng),
    deliveryAgentId: row.delivery_agent_id ?? null,
    claimedAt: row.claimed_at ?? null,
    priority: row.priority ?? false,
    hasReceipt: row.has_receipt ?? false,
    receiptUploadedAt: row.receipt_uploaded_at ?? null,
    customerPhone: row.customer_phone,
    // pg returns a `date` as a Date at local midnight; send it back as plain YYYY-MM-DD.
    pickupDate: row.pickup_date ? toYmd(row.pickup_date) : null,
    createdAt: row.created_at
  };

module.exports = {
  getAll: async () => {
    const { rows } = await pool.query(`select ${COLS} from orders order by id desc`);
    return rows.map(mapRow);
  },
  // A lean alternative to getAll() for the dashboard's queue/pending count,
  // which doesn't need full order history — it used to call getAll() and
  // filter in JS, reading every order ever placed just to count a few.
  getActive: async () => {
    const { rows } = await pool.query(
      `select ${COLS} from orders where status not in ('delivered', 'cancelled') order by id desc`
    );
    return rows.map(mapRow);
  },
  getRecent: async (limit = 5) => {
    const { rows } = await pool.query(`select ${COLS} from orders order by id desc limit $1`, [limit]);
    return rows.map(mapRow);
  },
  // Not-yet-paid orders that haven't been cancelled: how many, and how much.
  unpaidTotals: async () => {
    const { rows } = await pool.query(
      "select count(*)::int as count, coalesce(sum(total), 0) as total from orders where payment_status <> 'paid' and status <> 'cancelled'"
    );
    return { count: rows[0].count, total: Number(rows[0].total) };
  },
  countActive: async () => {
    const { rows } = await pool.query("select count(*)::int as count from orders where status not in ('delivered', 'cancelled')");
    return rows[0].count;
  },
  // `forUpdate` locks the row for the rest of the caller's transaction, so two
  // simultaneous cancel/status requests can't both act on the same old state.
  getById: async (id, db = pool, { forUpdate = false } = {}) => {
    const { rows } = await db.query(`select ${COLS} from orders where id = $1${forUpdate ? " for update" : ""}`, [
      Number(id)
    ]);
    return mapRow(rows[0]);
  },
  getByCustomerId: async (customerId) => {
    const { rows } = await pool.query(`select ${COLS} from orders where customer_id = $1 order by id desc`, [
      Number(customerId)
    ]);
    return rows.map(mapRow);
  },
  // Only orders created "today" in India time — the bakery's day, not the database
  // server's (Neon runs on UTC, which would put 12:00–5:30 AM IST orders on the wrong day).
  getToday: async () => {
    const { rows } = await pool.query(
      `select ${COLS} from orders
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
    deliveryFee,
    deliveryLat,
    deliveryLng,
    customerPhone,
    pickupDate
  }, db = pool) => {
    const { rows } = await db.query(
      `insert into orders (
         customer_name, customer_id, items, total, pickup_time, channel, payment_method, payment_status,
         delivery_type, delivery_zone, delivery_address, delivery_fee, delivery_lat, delivery_lng,
         customer_phone, pickup_date
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) returning ${COLS}`,
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
        deliveryFee === undefined ? null : deliveryFee,
        deliveryLat === undefined ? null : deliveryLat,
        deliveryLng === undefined ? null : deliveryLng,
        customerPhone || null,
        pickupDate || null
      ]
    );
    return mapRow(rows[0]);
  },
  updateStatus: async (id, status, db = pool) => {
    const { rows } = await db.query(`update orders set status = $1 where id = $2 returning ${COLS}`, [
      status,
      Number(id)
    ]);
    return mapRow(rows[0]);
  },
  updatePaymentStatus: async (id, paymentStatus) => {
    const { rows } = await pool.query(`update orders set payment_status = $1 where id = $2 returning ${COLS}`, [
      paymentStatus,
      Number(id)
    ]);
    return mapRow(rows[0]);
  },
  updatePriority: async (id, priority) => {
    const { rows } = await pool.query(`update orders set priority = $1 where id = $2 returning ${COLS}`, [
      Boolean(priority),
      Number(id)
    ]);
    return mapRow(rows[0]);
  },
  updatePickupTime: async (id, pickupTime) => {
    const { rows } = await pool.query(`update orders set pickup_time = $1 where id = $2 returning ${COLS}`, [
      pickupTime,
      Number(id)
    ]);
    return mapRow(rows[0]);
  },
  // Customer-uploaded payment receipt (screenshot of a UPI/bank confirmation) —
  // owner/staff review it before marking the order paid, same "Mark paid" action
  // as today, just now potentially informed by a receipt rather than blind trust.
  setReceipt: async (id, data, mime) => {
    const { rows } = await pool.query(
      `update orders set receipt_image = $1, receipt_mime = $2, receipt_uploaded_at = now()
       where id = $3 returning ${COLS}`,
      [data, mime, Number(id)]
    );
    return mapRow(rows[0]);
  },
  getReceiptImage: async (id) => {
    const { rows } = await pool.query("select receipt_image, receipt_mime from orders where id = $1", [Number(id)]);
    const row = rows[0];
    if (!row || !row.receipt_image) return null;
    return { data: row.receipt_image, mime: row.receipt_mime };
  },
  // Unclaimed, ready-to-go delivery orders — what a delivery partner's "Available"
  // list shows. Cancelled/delivered orders never have status 'ready' again, so
  // no extra filter is needed for those.
  getAvailableForDelivery: async () => {
    const { rows } = await pool.query(
      `select ${COLS} from orders where delivery_type = 'delivery' and status = 'ready' and delivery_agent_id is null order by id asc`
    );
    return rows.map(mapRow);
  },
  getClaimedByAgent: async (agentId) => {
    const { rows } = await pool.query(
      `select ${COLS} from orders where delivery_agent_id = $1 and status not in ('delivered', 'cancelled') order by claimed_at asc`,
      [Number(agentId)]
    );
    return rows.map(mapRow);
  },
  // Atomic "only if still unclaimed" update — the WHERE clause is what makes two
  // agents racing for the same order safe: whichever request's UPDATE actually
  // matches a row wins (returns it), the loser matches zero rows (returns undefined).
  claim: async (id, agentId) => {
    const { rows } = await pool.query(
      `update orders set delivery_agent_id = $1, claimed_at = now()
       where id = $2 and delivery_type = 'delivery' and status = 'ready' and delivery_agent_id is null
       returning ${COLS}`,
      [Number(agentId), Number(id)]
    );
    return mapRow(rows[0]);
  },
  // Backing out of a pickup — only the agent who holds it can release it, and
  // releasing just clears the claim so it's immediately available to everyone
  // else again, same as if nobody had claimed it.
  release: async (id, agentId) => {
    const { rows } = await pool.query(
      `update orders set delivery_agent_id = null, claimed_at = null where id = $1 and delivery_agent_id = $2 returning ${COLS}`,
      [Number(id), Number(agentId)]
    );
    return mapRow(rows[0]);
  },
  // Marking delivered, scoped to the agent who actually holds this order —
  // separate from the admin updateOrderStatus path, which any owner/staff can use.
  markDelivered: async (id, agentId) => {
    const { rows } = await pool.query(
      `update orders set status = 'delivered' where id = $1 and delivery_agent_id = $2 returning ${COLS}`,
      [Number(id), Number(agentId)]
    );
    return mapRow(rows[0]);
  }
};
