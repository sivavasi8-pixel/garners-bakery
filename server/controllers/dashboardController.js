const orders = require("../data/orders");
const inventory = require("../data/inventory");
const staff = require("../data/staff");
const asyncHandler = require("../middleware/asyncHandler");

exports.getSummary = asyncHandler(async (req, res) => {
  // Used to load every order ever placed (orders.getAll()) just to get a pending
  // count and the latest 5 — on a dashboard that re-fetches on every mutation, that
  // got slower every day the bakery stayed open. countActive/getRecent do the same
  // filtering in SQL instead of pulling full order history into Node each time.
  const [recentOrders, pendingCount, todaysOrders, inv, staffList] = await Promise.all([
    orders.getRecent(5),
    orders.countActive(),
    orders.getToday(),
    inventory.getAll(),
    staff.getAll()
  ]);

  // Cancelled orders never became sales, so they don't count toward revenue.
  const todaysSales = todaysOrders.filter((o) => o.status !== "cancelled");
  const todaysRevenue = todaysSales.reduce((sum, o) => sum + (o.total || 0), 0);

  const lowStock = inv.filter((i) => i.status === "low_stock" || i.status === "out_of_stock");

  const onShift = staffList.filter((s) => s.status === "clocked_in").length;

  res.json({
    todaysRevenue,
    ordersToday: todaysSales.length,
    pendingOrders: pendingCount,
    staffOnShift: onShift,
    staffTotal: staffList.length,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock,
    recentOrders
  });
});
