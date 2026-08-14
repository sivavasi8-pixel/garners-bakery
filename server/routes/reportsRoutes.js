const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reportsController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Finance/reports is owner-only per the product plan (staff get operational views, not financials).
router.get("/summary", requireAuth, requireRole("owner"), reportsController.getSummary);

module.exports = router;
