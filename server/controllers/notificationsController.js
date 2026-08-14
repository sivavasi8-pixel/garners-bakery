// Live, computed-on-request alerts — not a persisted notification log, so there's
// no read/unread state to track. Each request just reflects current data:
// pending orders + low stock for owner/staff, active order status for a customer.
const orders = require("../data/orders");
const inventory = require("../data/inventory");
const asyncHandler = require("../middleware/asyncHandler");

exports.getNotifications = asyncHandler(async (req, res) => {
  if (req.user.role === "customer") {
    const mine = await orders.getByCustomerId(req.user.id);
    const active = mine.filter((o) => o.status !== "delivered");
    const items = active.map((o) => ({
      id: `order-${o.id}`,
      type: "my_order",
      severity: o.status === "ready" ? "warning" : "info",
      title: `Order #${o.id} is ${o.status.replace("_", " ")}`,
      detail: o.status === "ready" ? "Ready for pickup!" : `Pickup: ${o.pickupTime || "TBD"}`
    }));
    return res.json({ count: items.length, items });
  }

  // owner/staff
  const [allOrders, inv] = await Promise.all([orders.getAll(), inventory.getAll()]);
  const pending = allOrders.filter((o) => o.status !== "delivered");
  const lowStock = inv.filter((i) => i.status === "low_stock" || i.status === "out_of_stock");

  const items = [
    ...lowStock.map((i) => ({
      id: `stock-${i.id}`,
      type: "low_stock",
      severity: i.status === "out_of_stock" ? "critical" : "warning",
      title: `${i.name} is ${i.status === "out_of_stock" ? "out of stock" : "running low"}`,
      detail: `${i.quantity} ${i.unit} left · reorder at ${i.reorderLevel}`
    })),
    ...pending.slice(0, 8).map((o) => ({
      id: `order-${o.id}`,
      type: "order_pending",
      severity: "info",
      title: `Order #${o.id} — ${o.status}`,
      detail: `${o.customerName} · ${o.items.map((it) => it.name).join(", ")}`
    }))
  ];

  res.json({ count: lowStock.length + pending.length, items });
});
