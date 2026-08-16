require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");

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

app.use(cors());
app.use(express.json());

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
  console.error(err);
  if (err.status) return res.status(err.status).json({ error: err.message });
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  const mode = process.env.DATABASE_URL ? "PostgreSQL" : "mock in-memory data";
  const serving = fs.existsSync(clientDist) ? "API + built frontend" : "API only (no client/dist build found)";
  console.log(`GARNERS Bakery API running on http://localhost:${PORT} — ${serving} (${mode})`);
});
