const orders = require("../data/orders");
const inventory = require("../data/inventory");
const recipes = require("../data/recipes");
const menuItems = require("../data/menuItems");
const asyncHandler = require("../middleware/asyncHandler");
const { withTransaction } = require("../config/transaction");
const { ZONES, calculateFee } = require("../data/deliveryZones");
const { upcomingDays, validateSlot } = require("../data/slots");

// The bakery is closed Mondays (Asia/Kolkata) — matches the static "closed on
// Mondays" graphic that used to be posted by hand every week.
const isClosedToday = () => {
  const day = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
  return day === "Mon";
};

// A 400 that the central error handler passes through with its message.
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const clip = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : undefined);

const MAX_QTY_PER_LINE = 100;
const MIN_CAKE_KG = 0.5;
const MAX_CAKE_KG = 20;

// Public (no auth) — the Order page checks this before anyone logs in.
// Also returns the bookable days and time slots for checkout (server/data/slots.js).
exports.getStoreStatus = (req, res) => {
  res.json({ closedToday: isClosedToday(), zones: ZONES, days: upcomingDays() });
};

// Turns the cart the browser sent into trusted order lines. Only the menu item id,
// quantity, cake size and note are taken from the request — name, price and
// availability always come from the database, so a tampered request can't set its
// own price or order something that's sold out.
const priceItems = async (rawItems, db) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw badRequest("items are required");
  if (rawItems.length > 50) throw badRequest("Too many lines in one order");

  const ids = rawItems.map((i) => Number(i && i.menuItemId));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw badRequest("Every item needs a valid menuItemId");
  }
  const menu = new Map((await menuItems.getForPricing([...new Set(ids)], db)).map((m) => [m.id, m]));

  let itemsTotal = 0;
  const lines = rawItems.map((raw, idx) => {
    const item = menu.get(ids[idx]);
    if (!item) throw badRequest("An item in your cart is no longer on the menu — please refresh");
    if (!item.inStock) throw badRequest(`${item.name} is sold out right now`);
    if (item.price === null) throw badRequest(`${item.name} is priced on request — please call the shop`);

    const qty = raw.qty === undefined ? 1 : Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      throw badRequest(`Quantity for ${item.name} must be between 1 and ${MAX_QTY_PER_LINE}`);
    }

    const line = { menuItemId: item.id, name: item.name, qty };

    // Custom cakes are priced by size: the menu's ₹/kg rate × kg chosen. Keyed on the
    // "custom" category (the Order page's custom-cake form), not the free-text unit,
    // so an ordinary item the owner lists "per kg" still sells as a single unit.
    if (item.category === "custom") {
      const size = Number(raw.size);
      if (!Number.isFinite(size) || size < MIN_CAKE_KG || size > MAX_CAKE_KG) {
        throw badRequest(`Choose a size between ${MIN_CAKE_KG} and ${MAX_CAKE_KG} kg for ${item.name}`);
      }
      line.size = size;
      line.price = Math.round(item.price * size);
      // Keep the customer's description (e.g. "Custom cake — Chocolate, 2kg") for the kitchen.
      line.name = clip(raw.name, 120) || `${item.name}, ${size}kg`;
    } else {
      line.price = item.price;
    }

    const note = clip(raw.note, 300);
    if (note) line.note = note;

    itemsTotal += line.price * qty;
    return line;
  });

  return { lines, itemsTotal };
};

// Shared by order creation (deduct) and cancellation (restock). Per-kg lines scale
// the recipe by their size, so a 2 kg cake uses twice the ingredients of a 1 kg one.
const adjustStockForItems = async (items, direction, db) => {
  const adjust = direction === "deduct" ? inventory.deduct : inventory.restock;
  for (const item of items) {
    if (!item.menuItemId) continue;
    const multiplier = (item.qty || 1) * (item.size || 1);
    const ingredients = await recipes.getForMenuItem(item.menuItemId, db);
    for (const ing of ingredients) {
      await adjust(ing.inventoryId, ing.qtyPerUnit * multiplier, db);
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
  const { items, pickupTime, pickupDate, pickupSlot, channel, paymentMethod, deliveryType, deliveryZone, deliveryAddress, customerPhone } = req.body;
  const validPayment = ["cash", "upi", "card"];
  if (paymentMethod && !validPayment.includes(paymentMethod)) {
    return res.status(400).json({ error: `paymentMethod must be one of ${validPayment.join(", ")}` });
  }

  // A logged-in customer's identity always wins. Staff/owner hitting this same
  // endpoint from the in-store POS supply a walk-in name instead — there's no
  // customer account for someone paying at the counter.
  const isCustomer = req.user.role === "customer";

  // Closed Mondays only block the public online storefront — staff/owner can
  // still log a walk-in or a phone order from the in-store POS.
  if (isCustomer && isClosedToday()) {
    return res.status(400).json({ error: "We're closed today (Monday). Online ordering reopens tomorrow." });
  }

  const isDelivery = deliveryType === "delivery";
  const address = clip(deliveryAddress, 500);
  // Required for delivery (especially the Porter-rate zone, where staff must call to
  // confirm the fee) — optional for pickup, since existing accounts predate this field.
  const phone = clip(customerPhone, 20);
  if (isDelivery && !phone) throw badRequest("A phone number is required for delivery orders");

  const order = await withTransaction(async (db) => {
    const { lines, itemsTotal } = await priceItems(items, db);

    // Online orders book a real day and time slot (no Mondays, no past times, a
    // day's notice for custom cakes). The POS can still pass free text like "Walk-in".
    let pickupText = clip(pickupTime, 100);
    let bookedDate = null;
    if (isCustomer || pickupDate || pickupSlot) {
      const hasCustomCake = lines.some((l) => l.size !== undefined);
      const slot = validateSlot({ date: pickupDate, slot: pickupSlot, hasCustomCake });
      if (slot.error) throw badRequest(slot.error);
      pickupText = slot.text;
      bookedDate = pickupDate;
    }

    let deliveryFee = null;
    if (isDelivery) {
      const zone = ZONES[deliveryZone];
      if (!zone) throw badRequest("A valid delivery zone is required");
      if (!address) throw badRequest("A delivery address is required");
      if (zone.minOrder && itemsTotal < zone.minOrder) {
        throw badRequest(`This zone needs a minimum order of ₹${zone.minOrder}`);
      }
      deliveryFee = calculateFee(deliveryZone, itemsTotal).fee; // null for Porter — confirmed manually by staff
    }

    // There's no payment gateway yet, so nothing online can be confirmed as paid
    // automatically. A POS sale is paid at the counter; every online order — UPI and
    // card included — starts "unpaid" until staff check the money actually arrived
    // and hit "Mark paid". (Previously UPI/card were marked paid with no money taken.)
    const paymentStatus = isCustomer ? "unpaid" : "paid";

    const created = await orders.create(
      {
        customerName: isCustomer ? req.user.name : clip(req.body.customerName, 80) || "Walk-in",
        customerId: isCustomer ? req.user.id : null,
        items: lines,
        total: itemsTotal + (deliveryFee || 0),
        pickupTime: pickupText,
        pickupDate: bookedDate,
        channel: isCustomer ? "online" : channel === "online" ? "online" : "in-store",
        paymentMethod: paymentMethod || "cash",
        paymentStatus,
        deliveryType: isDelivery ? "delivery" : "pickup",
        deliveryZone: isDelivery ? deliveryZone : null,
        deliveryAddress: isDelivery ? address : null,
        deliveryFee: isDelivery ? deliveryFee : null,
        customerPhone: phone || null
      },
      db
    );

    await adjustStockForItems(lines, "deduct", db);
    return created;
  });

  res.status(201).json({ order });
});

// Cancels inside one transaction (lock the order, flip status, give the stock back),
// so a double-click or two staff cancelling at once can't restock twice.
const cancelWithRestock = (orderId, user) =>
  withTransaction(async (db) => {
    const order = await orders.getById(orderId, db, { forUpdate: true });
    if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });

    if (user.role === "customer") {
      if (order.customerId !== user.id) throw Object.assign(new Error("Not your order"), { status: 403 });
      // A customer can only back out before the kitchen has started on it.
      if (order.status !== "placed") {
        throw badRequest("This order is already being prepared — ask the shop to cancel it");
      }
    }
    if (order.status === "delivered" || order.status === "cancelled") {
      throw badRequest(`Can't cancel an order that's already ${order.status}`);
    }

    const updated = await orders.updateStatus(orderId, "cancelled", db);
    await adjustStockForItems(order.items, "restock", db);
    return updated;
  });

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  // Cancelling always goes through the same path as the Cancel button, so stock is
  // returned no matter which screen or request did it.
  if (status === "cancelled") {
    return res.json({ order: await cancelWithRestock(req.params.id, req.user) });
  }

  const valid = ["placed", "baking", "ready", "delivered"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${valid.join(", ")}, cancelled` });
  }

  const order = await withTransaction(async (db) => {
    const current = await orders.getById(req.params.id, db, { forUpdate: true });
    if (!current) throw Object.assign(new Error("Order not found"), { status: 404 });
    // A cancelled order has already had its stock returned — reopening it would
    // bake without deducting again. Staff should place a fresh order instead.
    if (current.status === "cancelled") {
      throw badRequest("A cancelled order can't be reopened — place a new order instead");
    }
    return orders.updateStatus(req.params.id, status, db);
  });
  res.json({ order });
});

exports.cancelOrder = asyncHandler(async (req, res) => {
  res.json({ order: await cancelWithRestock(req.params.id, req.user) });
});

exports.updateOrderPickupTime = asyncHandler(async (req, res) => {
  const pickupTime = clip(req.body.pickupTime, 100);
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
