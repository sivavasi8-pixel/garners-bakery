const express = require("express");
const multer = require("multer");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Images live in Postgres (bytea), not on disk — memoryStorage keeps the upload as a Buffer only.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get("/", menuController.getMenu);
router.get("/:id/image", menuController.getImage);
router.get("/:id", menuController.getItem);

// Menu management is an owner-only action (see DESIGN.md/product plan: owner has "full control").
router.post("/", requireAuth, requireRole("owner"), upload.single("image"), menuController.createItem);
router.patch("/:id", requireAuth, requireRole("owner"), upload.single("image"), menuController.updateItem);
router.delete("/:id", requireAuth, requireRole("owner"), menuController.deleteItem);

router.get("/:id/recipe", requireAuth, requireRole("owner"), menuController.getRecipe);
router.put("/:id/recipe", requireAuth, requireRole("owner"), menuController.updateRecipe);

// Marking something sold out (or today's special) is a floor-operations action,
// not a catalog edit — owner+staff, same as availability. Creating a brand-new
// item (including a "special"-category one) stays owner-only, above.
router.patch("/:id/availability", requireAuth, requireRole("owner", "staff"), menuController.updateAvailability);
router.patch("/:id/special", requireAuth, requireRole("owner", "staff"), menuController.updateSpecial);

module.exports = router;
