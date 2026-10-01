const orders = require("../data/orders");
const inventory = require("../data/inventory");
const staff = require("../data/staff");
const asyncHandler = require("../middleware/asyncHandler");

exports.getSummary = asyncHandler(async (req, res) => {
  const [allOrders, todaysOrders, inv, staffList] = await Promise.all([
    orders.getAll(),
    orders.getToday(),
    inventory.getAll(),
    staff.getAll()
  ]);

  // Cancelled orders never became sales, so they don't count toward revenue.
  const todaysSales = todaysOrders.filter((o) => o.status !== "cancelled");
  const todaysRevenue = todaysSales.reduce((sum, o) => sum + (o.total || 0), 0);
  // Pending counts every unfulfilled order regardless of date — an order from
  // yesterday still needs baking, it shouldn't drop off the radar at midnight.
  // Cancelled orders are finished too, just not delivered.
  const pending = allOrders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;

  const lowStock = inv.filter((i) => i.status === "low_stock" || i.status === "out_of_stock");

  const onShift = staffList.filter((s) => s.status === "clocked_in").length;

  res.json({
    todaysRevenue,
    ordersToday: todaysSales.length,
    pendingOrders: pending,
    staffOnShift: onShift,
    staffTotal: staffList.length,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock,
    recentOrders: allOrders.slice(0, 5)
  });
});
