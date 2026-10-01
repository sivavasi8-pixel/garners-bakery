require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const { securityHeaders, rateLimit } = require("./middleware/security");
const { migrate } = require("./db/migrate");

const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const staffRoutes = require("./routes/staffRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const authRoutes = require("./routes/authRoutes");
const reportsRoutes = require("./routes/reportsRoutes");
const notificationsRoutes = require("./routes/notificationsRoutes");
const expensesRoutes = require("./routes/expensesRoutes");

const app = express();
const PORT = process.env.PORT || 4000;

// Render sits in front of the app as a proxy — trust one hop so req.ip is the real
// visitor (needed for the login rate limit) and req.secure reflects HTTPS.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);
// No CORS middleware: the React app is served from this same origin in production and
// through Vite's proxy in dev, so other websites have no reason to call this API.
app.use(express.json({ limit: "100kb" }));

// Slow down password guessing and signup spam: 10 attempts per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many attempts — please wait a few minutes and try again"
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "GARNERS Bakery API" }));

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/expenses", expensesRoutes);

// Serve the built React app (client/dist), if it exists — it only exists after
// `npm run build` in client/, which is what the deploy build step runs. Local dev
// doesn't build it (client runs separately via `vite dev` on its own port instead),
// so this whole block is a no-op there.
const clientDist = path.join(__dirname, "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Anything that isn't a static asset and isn't /api/* is a client-side route
  // (React Router) — hand it index.html and let the SPA take over.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Centralized error handler — catches anything asyncHandler-wrapped controllers pass to next().
// A handler can opt in to a specific status/message (e.g. a validation error) by
// setting err.status; anything else stays a generic 500 so internals never leak.
app.use((err, req, res, next) => {
  // Upload problems (file too big, wrong type) are the user's to fix, not a server fault.
  if (err.name === "MulterError") {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Photo is too large — 5 MB maximum" : err.message;
    return res.status(400).json({ error: message });
  }
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

// Bring the database schema up to date (new columns only — safe on every boot),
// then start taking requests.
migrate()
  .catch((err) => {
    console.error("Database migration failed:", err.message);
    process.exit(1);
  })
  .then(() =>
    app.listen(PORT, () => {
      const mode = process.env.DATABASE_URL ? "PostgreSQL" : "mock in-memory data";
      const serving = fs.existsSync(clientDist) ? "API + built frontend" : "API only (no client/dist build found)";
      console.log(`GARNERS Bakery API running on http://localhost:${PORT} — ${serving} (${mode})`);
    })
  );
