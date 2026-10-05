const express = require("express");
const router = express.Router();
const deliveryPartnersController = require("../controllers/deliveryPartnersController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Owner-only — adding/removing who can log in as a delivery partner.
router.use(requireAuth, requireRole("owner"));

router.get("/", deliveryPartnersController.list);
router.post("/", deliveryPartnersController.create);
router.delete("/:id", deliveryPartnersController.remove);

module.exports = router;
