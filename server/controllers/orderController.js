const orders = require("../data/orders");
const inventory = require("../data/inventory");
const recipes = require("../data/recipes");
const asyncHandler = require("../middleware/asyncHandler");

// Shared by order creation (deduct) and cancellation (restock) — items need a
// menuItemId to match a recipe; a missing recipe or id is a silent no-op for that line.
const adjustStockForItems = async (items, direction) => {
  const adjust = direction === "deduct" ? inventory.deduct : inventory.restock;
  for (const item of items) {
    if (!item.menuItemId) continue;
    const ingredients = await recipes.getForMenuItem(item.menuItemId);
    for (const ing of ingredients) {
      await adjust(ing.inventoryId, ing.qtyPerUnit * (item.qty || 1));
    }
  }
};

exports.getOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  let list = await orders.getAll();
  if (status) list = list.filter((o) => o.status === status);
  res.json({ orders: list });
});

exports.getMyOrders = asyncHandler(async (req, res) => {
  res.json({ orders: await orders.getByCustomerId(req.user.id) });
});

exports.getOrder = asyncHandler(async (req, res) => {
  const order = await orders.getById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  // A customer can only ever look up their own order (e.g. to view/print a receipt);
  // owner/staff can look up any order.
  if (req.user.role === "customer" && order.customerId !== req.user.id) {
    return res.status(403).json({ error: "Not your order" });
  }
  res.json({ order });
});

exports.createOrder = asyncHandler(async (req, res) => {
  const { items, total, pickupTime, channel, paymentMethod } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ error: "items are required" });
  }
  const validPayment = ["cash", "upi", "card"];
  if (paymentMethod && !validPayment.includes(paymentMethod)) {
    return res.status(400).json({ error: `paymentMethod must be one of ${validPayment.join(", ")}` });
  }

  // A logged-in customer's identity always wins. Staff/owner hitting this same
  // endpoint from the in-store POS supply a walk-in name instead — there's no
  // customer account for someone paying at the counter.
  const isCustomer = req.user.role === "customer";

  // No real payment gateway here (out of scope for a local dev app) — this simulates
  // the two realistic outcomes: a walk-in POS sale is paid on the spot regardless of
  // method, and an online order is only "paid" immediately for upi/card (treated as
  // prepaid); "cash" online means pay-on-pickup, so it stays unpaid until staff marks
  // it (see updatePayment below).
  const paymentStatus = !isCustomer || (paymentMethod && paymentMethod !== "cash") ? "paid" : "unpaid";

  const order = await orders.create({
    customerName: isCustomer ? req.user.name : req.body.customerName || "Walk-in",
    customerId: isCustomer ? req.user.id : null,
    items,
    total,
    pickupTime,
    channel: channel || (isCustomer ? "online" : "in-store"),
    paymentMethod: paymentMethod || "cash",
    paymentStatus
  });

  await adjustStockForItems(items, "deduct");

  res.status(201).json({ order });
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const valid = ["placed", "baking", "ready", "delivered", "cancelled"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${valid.join(", ")}` });
  }
  const order = await orders.updateStatus(req.params.id, status);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
});

exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await orders.getById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (req.user.role === "customer") {
    if (order.customerId !== req.user.id) {
      return res.status(403).json({ error: "Not your order" });
    }
    // A customer can only back out before the kitchen has started on it.
    if (order.status !== "placed") {
      return res.status(400).json({ error: "This order is already being prepared — ask the shop to cancel it" });
    }
  }

  if (order.status === "delivered" || order.status === "cancelled") {
    return res.status(400).json({ error: `Can't cancel an order that's already ${order.status}` });
  }

  const updated = await orders.updateStatus(req.params.id, "cancelled");
  await adjustStockForItems(order.items, "restock");
  res.json({ order: updated });
});

exports.updateOrderPickupTime = asyncHandler(async (req, res) => {
  const { pickupTime } = req.body;
  if (!pickupTime) return res.status(400).json({ error: "pickupTime is required" });
  const order = await orders.updatePickupTime(req.params.id, pickupTime);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
});

exports.updateOrderPayment = asyncHandler(async (req, res) => {
  const { paymentStatus } = req.body;
  if (!["unpaid", "paid"].includes(paymentStatus)) {
    return res.status(400).json({ error: "paymentStatus must be 'unpaid' or 'paid'" });
  }
  const order = await orders.updatePaymentStatus(req.params.id, paymentStatus);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
});
