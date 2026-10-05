const orders = require("../data/orders");
const asyncHandler = require("../middleware/asyncHandler");
const { haversineKm } = require("../services/distance");
const { STORE_LAT, STORE_LNG } = require("../config/storeLocation");

// Only what a delivery partner actually needs — never the admin's full order
// object (no payment internals beyond what they must collect, no other
// customers' data). Distance is straight-line from the shop and only known
// when the order itself has coordinates (i.e. the customer used "use my
// current location" at checkout) — a typed-only address has none to measure.
const deliveryView = (o) => ({
  id: o.id,
  customerName: o.customerName,
  customerPhone: o.customerPhone,
  deliveryAddress: o.deliveryAddress,
  deliveryLat: o.deliveryLat,
  deliveryLng: o.deliveryLng,
  distanceFromStoreKm:
    o.deliveryLat != null && o.deliveryLng != null
      ? Math.round(haversineKm(STORE_LAT, STORE_LNG, o.deliveryLat, o.deliveryLng) * 10) / 10
      : null,
  items: (o.items || []).map((i) => ({ name: i.name, qty: i.qty })),
  // Needed to know whether (and how much) cash to collect at the door.
  paymentMethod: o.paymentMethod,
  paymentStatus: o.paymentStatus,
  total: o.total,
  pickupTime: o.pickupTime,
  status: o.status,
  claimedAt: o.claimedAt,
  priority: o.priority
});

// Owner/staff-flagged urgent orders first, then closest to the shop, since
// that's a reasonable free default within each priority tier.
const byPriorityThenDistance = (a, b) => {
  if (a.priority !== b.priority) return a.priority ? -1 : 1;
  if (a.distanceFromStoreKm == null && b.distanceFromStoreKm == null) return a.id - b.id;
  if (a.distanceFromStoreKm == null) return 1; // unknown distance sorts last
  if (b.distanceFromStoreKm == null) return -1;
  return a.distanceFromStoreKm - b.distanceFromStoreKm || a.id - b.id;
};

// Straight-line distance between two orders' own drop points (not from the
// shop) — a cheap way to flag "these two are close together" without real
// route planning. Two orders with no coordinates are never considered nearby
// to each other (nothing to measure).
const NEARBY_KM = 1;
const attachNearby = (list) => {
  for (const o of list) {
    if (o.deliveryLat == null || o.deliveryLng == null) {
      o.nearbyOrderIds = [];
      continue;
    }
    o.nearbyOrderIds = list
      .filter(
        (other) =>
          other.id !== o.id &&
          other.deliveryLat != null &&
          other.deliveryLng != null &&
          haversineKm(o.deliveryLat, o.deliveryLng, other.deliveryLat, other.deliveryLng) <= NEARBY_KM
      )
      .map((other) => other.id);
  }
  return list;
};

// Unclaimed, ready-for-delivery orders.
exports.listAvailable = asyncHandler(async (req, res) => {
  const list = attachNearby((await orders.getAvailableForDelivery()).map(deliveryView)).sort(byPriorityThenDistance);
  res.json({ orders: list });
});

exports.listMine = asyncHandler(async (req, res) => {
  const list = await orders.getClaimedByAgent(req.user.id);
  res.json({ orders: list.map(deliveryView) });
});

exports.claim = asyncHandler(async (req, res) => {
  const claimed = await orders.claim(req.params.id, req.user.id);
  if (!claimed) {
    return res.status(409).json({ error: "Someone already picked this one up — check the available list again." });
  }
  res.json({ order: deliveryView(claimed) });
});

exports.release = asyncHandler(async (req, res) => {
  const released = await orders.release(req.params.id, req.user.id);
  if (!released) {
    return res.status(404).json({ error: "You don't currently have this order" });
  }
  res.json({ order: deliveryView(released) });
});

exports.markDelivered = asyncHandler(async (req, res) => {
  const delivered = await orders.markDelivered(req.params.id, req.user.id);
  if (!delivered) {
    return res.status(404).json({ error: "You don't currently have this order" });
  }
  res.json({ order: deliveryView(delivered) });
});
