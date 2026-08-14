const menuItems = require("../data/menuItems");
const recipes = require("../data/recipes");
const asyncHandler = require("../middleware/asyncHandler");

exports.getMenu = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const items = category ? await menuItems.getByCategory(category) : await menuItems.getAll();
  res.json({ items });
});

exports.getItem = asyncHandler(async (req, res) => {
  const item = await menuItems.getById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json({ item });
});

exports.getImage = asyncHandler(async (req, res) => {
  const image = await menuItems.getImage(req.params.id);
  if (!image) return res.status(404).end();
  res.set("Content-Type", image.mime || "application/octet-stream");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(image.data);
});

const fromRequest = (req) => ({
  name: req.body.name,
  category: req.body.category,
  price: req.body.price === "" || req.body.price == null ? null : Number(req.body.price),
  unit: req.body.unit,
  description: req.body.description,
  image: req.file ? { data: req.file.buffer, mime: req.file.mimetype } : null
});

exports.createItem = asyncHandler(async (req, res) => {
  const fields = fromRequest(req);
  if (!fields.name || !fields.category || !fields.unit) {
    return res.status(400).json({ error: "name, category and unit are required" });
  }
  const item = await menuItems.create(fields);
  res.status(201).json({ item });
});

exports.updateItem = asyncHandler(async (req, res) => {
  const fields = fromRequest(req);
  if (!fields.name || !fields.category || !fields.unit) {
    return res.status(400).json({ error: "name, category and unit are required" });
  }
  const item = await menuItems.update(req.params.id, fields);
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json({ item });
});

exports.deleteItem = asyncHandler(async (req, res) => {
  const ok = await menuItems.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Item not found" });
  res.status(204).end();
});

exports.updateAvailability = asyncHandler(async (req, res) => {
  const { inStock } = req.body;
  if (typeof inStock !== "boolean") {
    return res.status(400).json({ error: "inStock must be a boolean" });
  }
  const item = await menuItems.setInStock(req.params.id, inStock);
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json({ item });
});

exports.getRecipe = asyncHandler(async (req, res) => {
  res.json({ ingredients: await recipes.getForMenuItemDetailed(req.params.id) });
});

exports.updateRecipe = asyncHandler(async (req, res) => {
  const { ingredients } = req.body;
  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ error: "ingredients must be an array of { inventoryId, qtyPerUnit }" });
  }
  const updated = await recipes.setForMenuItem(req.params.id, ingredients);
  res.json({ ingredients: updated });
});
