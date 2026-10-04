const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

router.post("/login", authController.login);
router.post("/signup", authController.signup);
router.get("/me", requireAuth, authController.me);
router.post("/reset-password", authController.resetPassword);
router.post("/request-pin-reset", authController.requestPinReset);

module.exports = router;
