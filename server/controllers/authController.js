const bcrypt = require("bcryptjs");
const users = require("../data/users");
const { signToken, isProduction } = require("../middleware/auth");

// The demo passwords are published in this repo's README and schema.sql, so on the
// live site they're as good as no password. Production refuses them outright; set a
// real one with `node scripts/set-password.js <email> <new-password>`.
const PUBLISHED_DEMO_PASSWORDS = ["owner123", "staff123", "customer123"];
const asyncHandler = require("../middleware/asyncHandler");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose on purpose — covers Indian mobile numbers with or without a country code,
// and doesn't reject landlines or formatting like spaces/dashes outright.
const PHONE_RE = /^[+\d][\d\s-]{6,19}$/;

// staffId links a staff login to its roster row — the Staff page uses it to show
// which status dropdown is theirs.
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, staffId: u.staffId ?? null, phone: u.phone ?? null });

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const user = await users.findByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (isProduction && PUBLISHED_DEMO_PASSWORDS.includes(password)) {
    return res.status(403).json({
      error: "This account still uses a public demo password, so it's been locked. Set a new password to sign in."
    });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

exports.signup = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password || !phone) {
    return res.status(400).json({ error: "name, email, phone and password are required" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  if (!PHONE_RE.test(phone.trim())) {
    return res.status(400).json({ error: "Enter a valid phone number" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }
  if (await users.findByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }
  // Signup only ever creates customer accounts — owner/staff accounts are seeded, not self-served.
  const user = await users.createCustomer({
    name,
    email,
    phone: phone.trim(),
    passwordHash: bcrypt.hashSync(password, 10)
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await users.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});
