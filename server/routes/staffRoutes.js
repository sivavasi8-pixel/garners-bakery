const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth, requireRole("owner", "staff"));

router.get("/", staffController.getStaff);
router.get("/tasks", staffController.getTasks);
router.post("/tasks", staffController.createTask);
router.patch("/tasks/:id", staffController.updateTask);
router.delete("/tasks/:id", staffController.deleteTask);
router.patch("/:id/status", staffController.updateStatus);
// Adding/removing roster entries and editing the schedule are owner-only —
// staff can update their own status, not the roster itself.
router.post("/", requireRole("owner"), staffController.createStaffMember);
router.delete("/:id", requireRole("owner"), staffController.removeStaffMember);
router.patch("/:id/shift", requireRole("owner"), staffController.updateShift);

module.exports = router;
