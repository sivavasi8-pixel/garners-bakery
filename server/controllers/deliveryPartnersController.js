const bcrypt = require("bcryptjs");
const users = require("../data/users");
const asyncHandler = require("../middleware/asyncHandler");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicView = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone ?? null });

exports.list = asyncHandler(async (req, res) => {
  res.json({ partners: (await users.getAllDeliveryPartners()).map(publicView) });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  if (password.length < 8) return res.status(400).json({ error: "password must be at least 8 characters" });
  if (await users.findByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }
  const created = await users.createDeliveryAccount({
    name,
    email,
    phone: phone || null,
    passwordHash: bcrypt.hashSync(password, 10)
  });
  res.status(201).json({ partner: publicView(created) });
});

exports.remove = asyncHandler(async (req, res) => {
  const partner = await users.findById(req.params.id);
  if (!partner || partner.role !== "delivery") {
    return res.status(404).json({ error: "Delivery partner not found" });
  }
  try {
    const ok = await users.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: "Delivery partner not found" });
  } catch (err) {
    // Postgres 23503 = foreign_key_violation — this partner still has claimed
    // orders referencing them (delivery_agent_id). Ask them to finish or release
    // their deliveries first rather than silently orphaning an order's agent link.
    if (err.code === "23503") {
      return res.status(409).json({
        error: "This partner still has claimed deliveries in progress — have them finish or release those first."
      });
    }
    throw err;
  }
  res.status(204).end();
});
