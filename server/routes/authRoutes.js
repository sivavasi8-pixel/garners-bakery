const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

router.post("/login", authController.login);
router.post("/signup", authController.signup);
router.get("/me", requireAuth, authController.me);
router.patch("/me", requireAuth, authController.updateProfile);
router.post("/change-password", requireAuth, authController.changePassword);
router.post("/change-pin", requireAuth, authController.changePin);
router.post("/reset-password", authController.resetPassword);
router.post("/request-pin-reset", authController.requestPinReset);

module.exports = router;
