const inventory = require("../data/inventory");
const asyncHandler = require("../middleware/asyncHandler");

exports.getInventory = asyncHandler(async (req, res) => {
  res.json({ items: await inventory.getAll() });
});

exports.getItem = asyncHandler(async (req, res) => {
  const item = await inventory.getById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json({ item });
});

exports.createItem = asyncHandler(async (req, res) => {
  const { name, unit, quantity, reorderLevel, supplier } = req.body;
  if (!name || !unit) {
    return res.status(400).json({ error: "name and unit are required" });
  }
  const item = await inventory.create({ name, unit, quantity, reorderLevel, supplier });
  res.status(201).json({ item });
});

// Accepts any subset of fields — a quantity-only PATCH (e.g. a quick restock) still works,
// same contract this endpoint had before it grew name/unit/reorderLevel/supplier editing.
exports.updateItem = asyncHandler(async (req, res) => {
  const { name, unit, quantity, reorderLevel, supplier } = req.body;
  if (quantity != null && (typeof quantity !== "number" || quantity < 0)) {
    return res.status(400).json({ error: "quantity must be a non-negative number" });
  }
  const item = await inventory.update(req.params.id, { name, unit, quantity, reorderLevel, supplier });
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json({ item });
});

exports.deleteItem = asyncHandler(async (req, res) => {
  const ok = await inventory.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Item not found" });
  res.status(204).end();
});
