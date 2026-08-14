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

  const todaysRevenue = todaysOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  // Pending counts every unfulfilled order regardless of date — an order from
  // yesterday still needs baking, it shouldn't drop off the radar at midnight.
  const pending = allOrders.filter((o) => o.status !== "delivered").length;

  const lowStock = inv.filter((i) => i.status === "low_stock" || i.status === "out_of_stock");

  const onShift = staffList.filter((s) => s.status === "clocked_in").length;

  res.json({
    todaysRevenue,
    ordersToday: todaysOrders.length,
    pendingOrders: pending,
    staffOnShift: onShift,
    staffTotal: staffList.length,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock,
    recentOrders: allOrders.slice(0, 5)
  });
});
