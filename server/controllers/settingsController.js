const settings = require("../data/settings");
const asyncHandler = require("../middleware/asyncHandler");

// Explicit allowlist of what GET exposes publicly (no auth — the checkout page
// needs this before a customer necessarily has an account) — app_settings is a
// free-form store and could hold owner-only values later, so nothing is
// returned by default.
const PUBLIC_KEYS = ["upiVpa", "upiPayeeName"];

exports.getPublicSettings = asyncHandler(async (req, res) => {
  const all = await settings.getAll();
  const out = {};
  for (const k of PUBLIC_KEYS) out[k] = all[k] || null;
  res.json(out);
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const { upiVpa, upiPayeeName } = req.body;
  if (upiVpa !== undefined) await settings.set("upiVpa", upiVpa ? String(upiVpa).trim() : "");
  if (upiPayeeName !== undefined) await settings.set("upiPayeeName", upiPayeeName ? String(upiPayeeName).trim() : "");
  const all = await settings.getAll();
  const out = {};
  for (const k of PUBLIC_KEYS) out[k] = all[k] || null;
  res.json(out);
});
