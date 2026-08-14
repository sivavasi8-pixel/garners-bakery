const express = require("express");
const router = express.Router();
const notificationsController = require("../controllers/notificationsController");
const { requireAuth } = require("../middleware/auth");

// Any logged-in role — the controller branches on req.user.role for what to show.
router.get("/", requireAuth, notificationsController.getNotifications);

module.exports = router;
