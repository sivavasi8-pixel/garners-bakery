// Tests for the order, reporting and permission rules, run with `npm test`.
// The database layer is replaced by a small in-memory fake, so these need no
// Postgres and no network — they check the business rules, not SQL.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const Module = require("module");

// Freeze the clock on a Thursday, 12:00 IST (so "closed Mondays" never interferes).
mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-01T06:30:00Z") });

const root = path.join(__dirname, "..");
const stub = (rel, exports) => {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
// Libraries the controllers pull in but these tests don't exercise; stubbed only if
// they aren't installed, so the tests also run on a fresh checkout without `npm install`.
for (const [name, fake] of Object.entries({
  bcryptjs: { hashSync: (p) => `hash:${p}`, compareSync: (p, h) => h === `hash:${p}` },
  jsonwebtoken: { sign: () => "token", verify: () => ({}) }
})) {
  try {
    require.resolve(name);
  } catch {
    const orig = Module._resolveFilename;
    Module._resolveFilename = function (request, ...rest) {
      return request === name ? `stub:${name}` : orig.call(this, request, ...rest);
    };
    require.cache[`stub:${name}`] = { id: name, filename: name, loaded: true, exports: fake };
  }
}

// ---- in-memory "database" ----
let db;
const reset = () => {
  db = {
    menu: [
      { id: 1, name: "Sourdough loaf", category: "breads", price: 220, unit: "loaf", inStock: true },
      { id: 2, name: "Butter croissant", category: "breads", price: 90, unit: "pc", inStock: false },
      { id: 6, name: "Custom cake", category: "custom", price: 1200, unit: "kg", inStock: true },
      { id: 7, name: "Wedding cake", category: "custom", price: null, unit: "pc", inStock: true }
    ],
    recipes: { 1: [{ inventoryId: 4, qtyPerUnit: 0.5 }], 6: [{ inventoryId: 4, qtyPerUnit: 0.2 }] },
    inventory: { 4: 10 },
    orders: [],
    nextId: 1,
    users: [{ id: 2, staffId: 1, role: "staff" }],
    staff: [{ id: 1, status: "clocked_out" }, { id: 2, status: "clocked_out" }],
    failDeduct: false
  };
};
reset();

stub("data/menuItems.js", { getForPricing: async (ids) => db.menu.filter((m) => ids.includes(m.id)) });
stub("data/recipes.js", { getForMenuItem: async (id) => db.recipes[id] || [] });
stub("data/inventory.js", {
  deduct: async (id, amt) => {
    if (db.failDeduct) throw new Error("db down");
    db.inventory[id] = Math.max(0, db.inventory[id] - amt);
  },
  restock: async (id, amt) => {
    db.inventory[id] += amt;
  },
  getAll: async () => [],
  update: async (id, f) => ({ id, ...f })
});
stub("data/orders.js", {
  create: async (o) => {
    const order = { id: db.nextId++, status: "placed", createdAt: new Date().toISOString(), ...o };
    db.orders.push(order);
    return order;
  },
  getById: async (id) => db.orders.find((o) => o.id === Number(id)) || null,
  updateStatus: async (id, status) => {
    const o = db.orders.find((x) => x.id === Number(id));
    if (!o) return null;
    o.status = status;
    return o;
  },
  getAll: async () => [...db.orders].reverse(),
  getToday: async () => db.orders,
  getActive: async () => db.orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled"),
  getRecent: async (limit = 5) => [...db.orders].reverse().slice(0, limit),
  countActive: async () => db.orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length,
  unpaidTotals: async () => {
    const unpaid = db.orders.filter((o) => o.paymentStatus !== "paid" && o.status !== "cancelled");
    return { count: unpaid.length, total: unpaid.reduce((sum, o) => sum + o.total, 0) };
  }
});
stub("data/expenses.js", { getAll: async () => [] });
stub("data/staff.js", {
  getAll: async () => db.staff,
  updateStatus: async (id, status) => Object.assign(db.staff.find((s) => s.id === Number(id)), { status })
});
stub("data/users.js", { findById: async (id) => db.users.find((u) => u.id === Number(id)) });
// A transaction that really rolls back: snapshot the fake DB, restore it on error.
stub("config/transaction.js", {
  withTransaction: async (fn) => {
    const snapshot = structuredClone(db);
    try {
      return await fn({});
    } catch (err) {
      Object.assign(db, snapshot);
      throw err;
    }
  }
});

const orderController = require("../controllers/orderController");
const reportsController = require("../controllers/reportsController");
const dashboardController = require("../controllers/dashboardController");
const staffController = require("../controllers/staffController");
const inventoryController = require("../controllers/inventoryController");
const { rateLimit } = require("../middleware/security");

// Calls a controller like Express would; resolves to { status, body }.
const call = async (handler, { user, body = {}, params = {}, query = {} }) => {
  const res = {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    set() { return this; },
    end() { return this; }
  };
  let error;
  await handler({ user, body, params, query, ip: "1.1.1.1" }, res, (e) => (error = e));
  if (error) return { status: error.status || 500, body: { error: error.message } };
  return { status: res.statusCode, body: res.body };
};

const customer = { id: 10, name: "Priya", role: "customer" };
// The frozen clock is Thu 1 Oct 2026, 12:00 IST: 2 PM today is bookable, 11 AM has passed.
const BOOKING = { pickupDate: "2026-10-01", pickupSlot: "14:00" };
const staffUser = { id: 2, name: "Sara", role: "staff" };
const owner = { id: 1, name: "Owner", role: "owner" };

beforeEach(reset);

test("prices come from the menu, not from the request", async () => {
  const r = await call(orderController.createOrder, {
    user: customer,
    body: { ...BOOKING, items: [{ menuItemId: 1, qty: 2, price: 1, name: "hacked" }], total: 1, paymentMethod: "cash" }
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.order.total, 440);
  assert.equal(r.body.order.items[0].price, 220);
  assert.equal(r.body.order.items[0].name, "Sourdough loaf");
});

test("custom cake is priced per kg and uses ingredients per kg", async () => {
  const r = await call(orderController.createOrder, {
    user: customer,
    body: { ...BOOKING, pickupDate: "2026-10-02", items: [{ menuItemId: 6, qty: 1, size: 2, price: 5, name: "Custom cake — Chocolate, 2kg" }] }
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.order.total, 2400);
  assert.equal(db.inventory[4], 10 - 0.2 * 2);
});

test("custom cake without a valid size is rejected", async () => {
  const r = await call(orderController.createOrder, { user: customer, body: { ...BOOKING, items: [{ menuItemId: 6, size: 0 }] } });
  assert.equal(r.status, 400);
});

test("sold-out, unpriced, unknown items and bad quantities are rejected", async () => {
  for (const item of [{ menuItemId: 2 }, { menuItemId: 7 }, { menuItemId: 999 }, { menuItemId: 1, qty: -3 }, { menuItemId: 1, qty: 1.5 }]) {
    const r = await call(orderController.createOrder, { user: customer, body: { ...BOOKING, items: [item] } });
    assert.equal(r.status, 400, JSON.stringify(item));
  }
  assert.equal(db.orders.length, 0);
});

test("online UPI/card orders start unpaid; POS sales are paid", async () => {
  const upi = await call(orderController.createOrder, { user: customer, body: { ...BOOKING, items: [{ menuItemId: 1 }], paymentMethod: "upi" } });
  assert.equal(upi.body.order.paymentStatus, "unpaid");
  const pos = await call(orderController.createOrder, { user: staffUser, body: { items: [{ menuItemId: 1 }], paymentMethod: "upi", customerName: "Walk-in" } });
  assert.equal(pos.body.order.paymentStatus, "paid");
  assert.equal(pos.body.order.channel, "in-store");
});

test("delivery fee is added on the server", async () => {
  const r = await call(orderController.createOrder, {
    user: customer,
    body: { ...BOOKING,
      items: [{ menuItemId: 1, qty: 2 }],
      deliveryType: "delivery",
      deliveryZone: "whitefield",
      deliveryAddress: "12 Main Rd",
      customerPhone: "9876543210"
    }
  });
  assert.equal(r.body.order.deliveryFee, 30);
  assert.equal(r.body.order.total, 470);
  assert.equal(r.body.order.customerPhone, "9876543210");
});

test("delivery without a phone number is rejected", async () => {
  const r = await call(orderController.createOrder, {
    user: customer,
    body: { ...BOOKING, items: [{ menuItemId: 1, qty: 2 }], deliveryType: "delivery", deliveryZone: "whitefield", deliveryAddress: "12 Main Rd" }
  });
  assert.equal(r.status, 400);
});

test("if stock deduction fails, the order is not saved", async () => {
  db.failDeduct = true;
  const r = await call(orderController.createOrder, { user: customer, body: { ...BOOKING, items: [{ menuItemId: 1 }] } });
  assert.equal(r.status, 500);
  assert.equal(db.orders.length, 0);
});

test("cancelling via the status dropdown returns stock, and can't be reopened", async () => {
  const { body } = await call(orderController.createOrder, { user: customer, body: { ...BOOKING, items: [{ menuItemId: 1, qty: 2 }] } });
  assert.equal(db.inventory[4], 9);
  const c = await call(orderController.updateOrderStatus, { user: staffUser, params: { id: body.order.id }, body: { status: "cancelled" } });
  assert.equal(c.body.order.status, "cancelled");
  assert.equal(db.inventory[4], 10);
  const again = await call(orderController.cancelOrder, { user: staffUser, params: { id: body.order.id } });
  assert.equal(again.status, 400);
  assert.equal(db.inventory[4], 10);
  const reopen = await call(orderController.updateOrderStatus, { user: staffUser, params: { id: body.order.id }, body: { status: "placed" } });
  assert.equal(reopen.status, 400);
});

test("customers can only cancel their own order while it's placed", async () => {
  const { body } = await call(orderController.createOrder, { user: customer, body: { ...BOOKING, items: [{ menuItemId: 1 }] } });
  const other = await call(orderController.cancelOrder, { user: { ...customer, id: 99 }, params: { id: body.order.id } });
  assert.equal(other.status, 403);
  await call(orderController.updateOrderStatus, { user: staffUser, params: { id: body.order.id }, body: { status: "baking" } });
  const late = await call(orderController.cancelOrder, { user: customer, params: { id: body.order.id } });
  assert.equal(late.status, 400);
});

test("reports and dashboard leave out cancelled orders and use India dates", async () => {
  db.orders.push(
    { id: 1, status: "delivered", total: 300, items: [{ name: "A", qty: 1 }], createdAt: "2026-09-30T19:00:00Z" }, // 00:30 IST Oct 1
    { id: 2, status: "cancelled", total: 5000, items: [{ name: "B", qty: 9 }], createdAt: "2026-10-01T05:00:00Z" },
    { id: 3, status: "placed", total: 200, items: [{ name: "A", qty: 1 }], createdAt: "2026-10-01T05:00:00Z" }
  );
  const rep = await call(reportsController.getSummary, { user: owner });
  const today = rep.body.last7Days.at(-1);
  assert.equal(today.date, "2026-10-01");
  assert.equal(today.revenue, 500);
  assert.equal(rep.body.allTimeRevenue, 500);
  assert.deepEqual(rep.body.bestSellers, [{ name: "A", qty: 2 }]);

  const dash = await call(dashboardController.getSummary, { user: owner });
  assert.equal(dash.body.todaysRevenue, 500);
  assert.equal(dash.body.pendingOrders, 1);
  // Queue holds only orders still in progress; money to collect skips cancelled ones.
  assert.deepEqual(dash.body.queue.map((o) => o.id), [3]);
  assert.equal(dash.body.toBake, 1);
  assert.equal(dash.body.awaitingPayment.count, 2);
  assert.equal(dash.body.awaitingPayment.total, 500);
});

test("staff can change only their own clock status; owner can change anyone's", async () => {
  const own = await call(staffController.updateStatus, { user: staffUser, params: { id: 1 }, body: { status: "clocked_in" } });
  assert.equal(own.status, 200);
  const other = await call(staffController.updateStatus, { user: staffUser, params: { id: 2 }, body: { status: "absent" } });
  assert.equal(other.status, 403);
  const byOwner = await call(staffController.updateStatus, { user: owner, params: { id: 2 }, body: { status: "absent" } });
  assert.equal(byOwner.status, 200);
});

test("staff can restock quantities but not rename ingredients", async () => {
  const qty = await call(inventoryController.updateItem, { user: staffUser, params: { id: 4 }, body: { quantity: 20 } });
  assert.equal(qty.status, 200);
  const rename = await call(inventoryController.updateItem, { user: staffUser, params: { id: 4 }, body: { name: "Sugar" } });
  assert.equal(rename.status, 403);
});

test("login rate limit blocks the 11th attempt", () => {
  const limiter = rateLimit({ windowMs: 60000, max: 10, message: "slow down" });
  let blocked = 0;
  for (let i = 0; i < 11; i++) {
    const res = { set() {}, status(c) { this.code = c; return this; }, json() { blocked++; } };
    limiter({ ip: "9.9.9.9" }, res, () => {});
  }
  assert.equal(blocked, 1);
});

test("pickup slots: no Mondays, no past times, a day's notice for custom cakes", async () => {
  const book = (extra, items = [{ menuItemId: 1 }]) =>
    call(orderController.createOrder, { user: customer, body: { ...BOOKING, ...extra, items } });
  assert.equal((await book({ pickupDate: undefined, pickupSlot: undefined })).status, 400, "no slot chosen");
  assert.equal((await book({ pickupDate: "2026-10-05" })).status, 400, "Monday");
  assert.equal((await book({ pickupSlot: "11:00" })).status, 400, "11 AM today has passed");
  assert.equal((await book({ pickupSlot: "10:15" })).status, 400, "not a real slot");
  assert.equal((await book({ pickupDate: "2026-10-20" })).status, 400, "too far ahead");
  assert.equal((await book({}, [{ menuItemId: 6, size: 1 }])).status, 400, "custom cake for today");
  const ok = await book({ pickupDate: "2026-10-03", pickupSlot: "17:30" });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.order.pickupTime, "Sat 3 Oct, 5:30 PM");
  assert.equal(ok.body.order.pickupDate, "2026-10-03");
  // The counter can still log a walk-in without a slot.
  const pos = await call(orderController.createOrder, { user: staffUser, body: { items: [{ menuItemId: 1 }], pickupTime: "Walk-in" } });
  assert.equal(pos.status, 201);
  assert.equal(pos.body.order.pickupTime, "Walk-in");
});

test("store status lists bookable days with Monday closed", () => {
  let body;
  orderController.getStoreStatus({}, { json: (b) => (body = b) });
  assert.equal(body.days[0].label, "Today");
  assert.equal(body.days[0].slots[0].value, "13:00", "first slot at least 45 minutes after noon");
  assert.equal(body.days[0].slots.at(-1).label, "8:00 PM");
  const monday = body.days.find((d) => d.date === "2026-10-05");
  assert.equal(monday.closed, true);
  assert.equal(monday.slots.length, 0);
});
