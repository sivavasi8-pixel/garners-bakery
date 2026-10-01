const orders = require("../data/orders");
const inventory = require("../data/inventory");
const staff = require("../data/staff");
const asyncHandler = require("../middleware/asyncHandler");

exports.getSummary = asyncHandler(async (req, res) => {
  // Used to load every order ever placed (orders.getAll()) just to get a pending
  // count and the latest 5 — on a dashboard that re-fetches on every mutation, that
  // got slower every day the bakery stayed open. countActive/getRecent do the same
  // filtering in SQL instead of pulling full order history into Node each time.
  const [recentOrders, pendingCount, active, unpaid, todaysOrders, inv, staffList] = await Promise.all([
    orders.getRecent(5),
    orders.countActive(),
    orders.getActive(),
    orders.unpaidTotals(),
    orders.getToday(),
    inventory.getAll(),
    staff.getAll()
  ]);

  // Cancelled orders never became sales, so they don't count toward revenue.
  const todaysSales = todaysOrders.filter((o) => o.status !== "cancelled");
  const todaysRevenue = todaysSales.reduce((sum, o) => sum + (o.total || 0), 0);

  const lowStock = inv.filter((i) => i.status === "low_stock" || i.status === "out_of_stock");

  const onShift = staffList.filter((s) => s.status === "clocked_in").length;

  // "What needs doing now": orders still in progress, soonest booked day first
  // (orders without a booked day — POS walk-ins, older orders — after those, newest first).
  const inProgress = active.filter((o) => ["placed", "baking", "ready"].includes(o.status));
  const queue = [...inProgress].sort((a, b) => {
    if (a.pickupDate && b.pickupDate) return a.pickupDate.localeCompare(b.pickupDate) || a.id - b.id;
    if (a.pickupDate) return -1;
    if (b.pickupDate) return 1;
    return b.id - a.id;
  });
  const toBake = inProgress.filter((o) => o.status === "placed" || o.status === "baking").length;

  res.json({
    todaysRevenue,
    ordersToday: todaysSales.length,
    pendingOrders: pendingCount,
    staffOnShift: onShift,
    staffTotal: staffList.length,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock,
    recentOrders,
    queue: queue.slice(0, 8),
    activeCount: inProgress.length,
    toBake,
    awaitingPayment: unpaid,
    staff: staffList.map((s) => ({ id: s.id, name: s.name, role: s.role, shift: s.shift, status: s.status }))
  });
});
