const crypto = require("crypto");
const menuItems = require("../data/menuItems");
const recipes = require("../data/recipes");
const asyncHandler = require("../middleware/asyncHandler");

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// Serves an uploaded photo with an ETag so a replaced image is picked up immediately.
// Cache-Control: no-cache makes the browser always revalidate — cheap (just a hash
// compare, 304 with no body) rather than blindly trusting a time-based cache, which
// previously let a replaced photo show stale for up to an hour at the same URL.
const sendImage = (req, res, image) => {
  if (!image) return res.status(404).end();
  const etag = `"${crypto.createHash("sha1").update(image.data).digest("hex")}"`;
  res.set("ETag", etag);
  res.set("Cache-Control", "no-cache");
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  res.set("Content-Type", image.mime || "application/octet-stream");
  res.send(image.data);
};

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
  sendImage(req, res, await menuItems.getImage(req.params.id));
});

// Throws instead of silently saving NaN/a negative number — which previously either
// got stored as-is (a negative price) or hit Postgres's own "invalid input syntax for
// type numeric" and surfaced as a generic 500.
const parsePrice = (raw) => {
  if (raw === "" || raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw badRequest("price must be a non-negative number, or blank for made-to-order");
  return n;
};

const fromRequest = (req) => ({
  name: req.body.name,
  category: req.body.category,
  price: parsePrice(req.body.price),
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

exports.updateSpecial = asyncHandler(async (req, res) => {
  const { isSpecial } = req.body;
  if (typeof isSpecial !== "boolean") {
    return res.status(400).json({ error: "isSpecial must be a boolean" });
  }
  const item = await menuItems.setSpecial(req.params.id, isSpecial);
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json({ item });
});

exports.updatePopular = asyncHandler(async (req, res) => {
  const { isPopular } = req.body;
  if (typeof isPopular !== "boolean") {
    return res.status(400).json({ error: "isPopular must be a boolean" });
  }
  const item = await menuItems.setPopular(req.params.id, isPopular);
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json({ item });
});

exports.getGalleryImage = asyncHandler(async (req, res) => {
  sendImage(req, res, await menuItems.getGalleryImage(req.params.id, req.params.imageId));
});

exports.addGalleryImage = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "image is required" });
  const item = await menuItems.addGalleryImage(req.params.id, { data: req.file.buffer, mime: req.file.mimetype });
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.status(201).json({ item });
});

exports.deleteGalleryImage = asyncHandler(async (req, res) => {
  const item = await menuItems.removeGalleryImage(req.params.id, req.params.imageId);
  if (!item) return res.status(404).json({ error: "Item or photo not found" });
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
