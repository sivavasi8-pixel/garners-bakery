const bcrypt = require("bcryptjs");
const staff = require("../data/staff");
const users = require("../data/users");
const asyncHandler = require("../middleware/asyncHandler");

exports.getStaff = asyncHandler(async (req, res) => {
  res.json({ staff: await staff.getAll() });
});

exports.createStaffMember = asyncHandler(async (req, res) => {
  const { name, role, shift, email, password } = req.body;
  if (!name || !role || !shift) {
    return res.status(400).json({ error: "name, role and shift are required" });
  }

  // Granting a login is optional (some roster entries, e.g. delivery, may not need app
  // access) — but validate it fully *before* creating the roster row, so a bad email/
  // password doesn't leave an orphaned staff entry with no account behind it.
  const grantingLogin = Boolean(email || password);
  if (grantingLogin) {
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are both required to grant a login" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }
    if (await users.findByEmail(email)) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
  }

  const person = await staff.create({ name, role, shift });
  const account = grantingLogin
    ? await users.createStaffAccount({ name, email, passwordHash: bcrypt.hashSync(password, 10), staffId: person.id })
    : null;

  res.status(201).json({ staff: person, account: account ? { email: account.email } : null });
});

exports.removeStaffMember = asyncHandler(async (req, res) => {
  const ok = await staff.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Staff member not found" });
  res.status(204).end();
});

exports.getTasks = asyncHandler(async (req, res) => {
  res.json({ tasks: await staff.getTasks() });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const valid = ["clocked_in", "on_break", "absent", "clocked_out"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${valid.join(", ")}` });
  }
  const person = await staff.updateStatus(req.params.id, status);
  if (!person) return res.status(404).json({ error: "Staff member not found" });
  res.json({ staff: person });
});

exports.updateShift = asyncHandler(async (req, res) => {
  const { shift } = req.body;
  if (!shift) return res.status(400).json({ error: "shift is required" });
  const person = await staff.updateShift(req.params.id, shift);
  if (!person) return res.status(404).json({ error: "Staff member not found" });
  res.json({ staff: person });
});

exports.createTask = asyncHandler(async (req, res) => {
  const { description, assignedTo, due } = req.body;
  if (!description || !assignedTo) {
    return res.status(400).json({ error: "description and assignedTo are required" });
  }
  const task = await staff.createTask({ description, assignedTo, due: due || "" });
  res.status(201).json({ task });
});

exports.updateTask = asyncHandler(async (req, res) => {
  const { description, assignedTo, due, done } = req.body;
  if (done !== undefined && typeof done !== "boolean") {
    return res.status(400).json({ error: "done must be a boolean" });
  }
  const task = await staff.updateTask(req.params.id, { description, assignedTo, due, done });
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json({ task });
});

exports.deleteTask = asyncHandler(async (req, res) => {
  const ok = await staff.deleteTask(req.params.id);
  if (!ok) return res.status(404).json({ error: "Task not found" });
  res.status(204).end();
});
