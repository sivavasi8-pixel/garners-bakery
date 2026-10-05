const express = require("express");
const router = express.Router();
const deliveryController = require("../controllers/deliveryController");
const { requireAuth, requireRole } = require("../middleware/auth");

// A delivery partner's own self-service endpoints — claiming, releasing, and
// marking their own deliveries done. Owner/staff manage orders through the
// regular /api/orders routes instead.
router.use(requireAuth, requireRole("delivery"));

router.get("/orders/available", deliveryController.listAvailable);
router.get("/orders/mine", deliveryController.listMine);
router.patch("/orders/:id/claim", deliveryController.claim);
router.patch("/orders/:id/release", deliveryController.release);
router.patch("/orders/:id/delivered", deliveryController.markDelivered);

module.exports = router;
