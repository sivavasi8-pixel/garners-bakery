const jwt = require("jsonwebtoken");

// Dev-only fallback secret. It's public (it's in this repo), so anyone could forge an
// owner login with it — in production (Render sets RENDER=true) the server refuses to
// start without a real JWT_SECRET rather than silently falling back.
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error(
    "JWT_SECRET must be set to a long random string (32+ characters) in production. " +
      "Add it under Environment in the Render dashboard."
  );
}
const JWT_SECRET = process.env.JWT_SECRET || "garners-dev-secret-do-not-use-in-prod";

function signToken(user) {
  return jwt.sign({ sub: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Login required" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, name: payload.name, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Login required" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have access to this" });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, JWT_SECRET, isProduction };
