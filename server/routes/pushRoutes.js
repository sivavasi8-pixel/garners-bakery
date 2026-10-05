const express = require("express");
const router = express.Router();
const pushController = require("../controllers/pushController");
const { requireAuth } = require("../middleware/auth");

// Any logged-in role can register/unregister a device for push notifications.
router.post("/register", requireAuth, pushController.register);
router.post("/unregister", requireAuth, pushController.unregister);

module.exports = router;
