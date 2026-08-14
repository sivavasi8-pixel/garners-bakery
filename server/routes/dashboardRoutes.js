const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/summary", requireAuth, requireRole("owner", "staff"), dashboardController.getSummary);

module.exports = router;
