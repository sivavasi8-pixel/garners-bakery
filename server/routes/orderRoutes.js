const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { requireAuth, requireRole } = require("../middleware/auth");

// A logged-in customer's own order history — must come before "/:id" or "mine" would be parsed as an id.
router.get("/mine", requireAuth, requireRole("customer"), orderController.getMyOrders);

// Internal order queue — owner/staff only.
router.get("/", requireAuth, requireRole("owner", "staff"), orderController.getOrders);

// Single-order lookup: any logged-in role, but the controller only lets a customer
// see their own order (needed so a customer can view/print their own receipt).
router.get("/:id", requireAuth, orderController.getOrder);

router.patch("/:id/status", requireAuth, requireRole("owner", "staff"), orderController.updateOrderStatus);
router.patch("/:id/payment", requireAuth, requireRole("owner", "staff"), orderController.updateOrderPayment);
router.patch("/:id/pickup-time", requireAuth, requireRole("owner", "staff"), orderController.updateOrderPickupTime);

// Any logged-in role — the controller enforces a customer can only cancel their own,
// and only while it's still "placed" (owner/staff can cancel up until delivered).
router.patch("/:id/cancel", requireAuth, orderController.cancelOrder);

// Anyone logged in can place an order: a customer checking out online, or
// staff/owner ringing up a walk-in at the in-store POS.
router.post("/", requireAuth, requireRole("owner", "staff", "customer"), orderController.createOrder);

module.exports = router;
