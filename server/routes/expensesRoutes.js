const express = require("express");
const router = express.Router();
const expensesController = require("../controllers/expensesController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Financial data — owner-only, same as reports.
router.use(requireAuth, requireRole("owner"));

router.get("/", expensesController.getExpenses);
router.post("/", expensesController.createExpense);
router.delete("/:id", expensesController.deleteExpense);

module.exports = router;
