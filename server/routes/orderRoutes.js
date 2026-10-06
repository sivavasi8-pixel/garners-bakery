const express = require("express");
const multer = require("multer");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Receipt photos live in Postgres (bytea), not on disk — memoryStorage keeps
// the upload as a Buffer only. Same allowlist/size cap as menu photos
// (routes/menuRoutes.js): real photo formats only, since these are served
// back from our own domain.
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error("Receipt must be a JPEG, PNG, WebP or GIF image"), { status: 400 }));
  }
});

// Public — no login needed to see whether the bakery is open today, or the delivery
// zone list, before a customer even starts browsing. Must come before "/:id".
router.get("/store-status", orderController.getStoreStatus);

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
router.patch("/:id/priority", requireAuth, requireRole("owner", "staff"), orderController.updateOrderPriority);

// A customer uploads proof of payment for their own order; owner/staff review
// it (same lookup, broader role) before marking paid.
router.post("/:id/receipt", requireAuth, upload.single("receipt"), orderController.uploadReceipt);
router.get("/:id/receipt", requireAuth, orderController.getReceipt);

// Any logged-in role — the controller enforces a customer can only cancel their own,
// and only while it's still "placed" (owner/staff can cancel up until delivered).
router.patch("/:id/cancel", requireAuth, orderController.cancelOrder);

// Anyone logged in can place an order: a customer checking out online, or
// staff/owner ringing up a walk-in at the in-store POS.
router.post("/", requireAuth, requireRole("owner", "staff", "customer"), orderController.createOrder);

module.exports = router;
