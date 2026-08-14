import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";

const statusOptions = ["clocked_in", "on_break", "absent", "clocked_out"];

export default function Staff() {
  const [staff, setStaff] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [shiftDraft, setShiftDraft] = useState("");
  const [newTask, setNewTask] = useState({ description: "", assignedTo: "", due: "" });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskDraft, setTaskDraft] = useState({ description: "", assignedTo: "", due: "" });
  const [newStaff, setNewStaff] = useState({ name: "", role: "", shift: "", grantLogin: false, email: "", password: "" });
  const [addingStaff, setAddingStaff] = useState(false);
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const load = () =>
    Promise.all([api.getStaff(), api.getTasks()])
      .then(([s, t]) => {
        setStaff(s.staff);
        setTasks(t.tasks);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (id, status) => {
    setActionError(null);
    try {
      await api.updateStaffStatus(id, status);
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const startShiftEdit = (person) => {
    setEditingShiftId(person.id);
    setShiftDraft(person.shift);
  };

  const saveShift = async (id) => {
    setActionError(null);
    try {
      await api.updateStaffShift(id, shiftDraft);
      setEditingShiftId(null);
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const toggleTask = async (task) => {
    setActionError(null);
    try {
      await api.updateTask(task.id, { done: !task.done });
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const startTaskEdit = (task) => {
    setEditingTaskId(task.id);
    setTaskDraft({ description: task.description, assignedTo: task.assignedTo, due: task.due });
  };

  const saveTaskEdit = async (id) => {
    setActionError(null);
    try {
      await api.updateTask(id, taskDraft);
      setEditingTaskId(null);
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!confirm(`Delete task "${task.description}"?`)) return;
    setActionError(null);
    try {
      await api.deleteTask(task.id);
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.description || !newTask.assignedTo) return;
    setActionError(null);
    try {
      await api.createTask(newTask);
      setNewTask({ description: "", assignedTo: "", due: "" });
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.role || !newStaff.shift) return;
    setActionError(null);
    setAddingStaff(true);
    try {
      await api.createStaffMember({
        name: newStaff.name,
        role: newStaff.role,
        shift: newStaff.shift,
        ...(newStaff.grantLogin ? { email: newStaff.email, password: newStaff.password } : {})
      });
      setNewStaff({ name: "", role: "", shift: "", grantLogin: false, email: "", password: "" });
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (person) => {
    if (!confirm(`Remove ${person.name} from the roster? This also removes their login if they have one.`)) return;
    setActionError(null);
    try {
      await api.deleteStaffMember(person.id);
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (error) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load staff: {error}</p>;
  if (!staff || !tasks) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading staff…</p>;

  const onShift = staff.filter((s) => s.status === "clocked_in").length;
  const absent = staff.filter((s) => s.status === "absent").length;
  const openTasks = tasks.filter((t) => !t.done).length;

  return (
    <div style={{ padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Staff</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
        {staff.length} team members.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
          marginBottom: "24px"
        }}
      >
        <MetricCard label="On shift now" value={onShift} />
        <MetricCard label="Open tasks" value={openTasks} />
        <MetricCard label="Absent today" value={absent} tone={absent ? "warning" : "default"} />
      </div>

      {actionError && <p style={{ fontSize: "13px", color: "var(--red)", marginBottom: "14px" }}>{actionError}</p>}

      <div className="split-2col" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "20px" }}>
        <section>
          <h2 style={{ fontSize: "16px", marginBottom: "10px" }}>Today's roster</h2>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            {staff.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "var(--surface-1)",
                  borderBottom: i < staff.length - 1 ? "1px solid var(--border)" : "none",
                  gap: "10px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--surface-2)",
                      color: "var(--wood)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 500,
                      flexShrink: 0
                    }}
                  >
                    {s.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px" }}>{s.name}</p>
                    {editingShiftId === s.id ? (
                      <div style={{ display: "flex", gap: "4px", marginTop: "2px" }}>
                        <input
                          value={shiftDraft}
                          onChange={(e) => setShiftDraft(e.target.value)}
                          style={{ fontSize: "12px", padding: "2px 6px", border: "1px solid var(--border)", borderRadius: "4px", width: "100px" }}
                        />
                        <button onClick={() => saveShift(s.id)} style={{ fontSize: "11px", border: "none", background: "none", color: "var(--green)", cursor: "pointer" }}>Save</button>
                        <button onClick={() => setEditingShiftId(null)} style={{ fontSize: "11px", border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>Cancel</button>
                      </div>
                    ) : (
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                        {s.role} · {s.shift}
                        {isOwner && (
                          <button
                            onClick={() => startShiftEdit(s)}
                            style={{ marginLeft: "6px", fontSize: "11px", border: "none", background: "none", color: "var(--green)", cursor: "pointer" }}
                          >
                            edit
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <StatusBadge status={s.status} />
                  <select
                    value={s.status}
                    onChange={(e) => handleStatusChange(s.id, e.target.value)}
                    style={{ fontSize: "12px", padding: "4px 6px", border: "1px solid var(--border)", borderRadius: "6px" }}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt.replace("_", " ")}</option>
                    ))}
                  </select>
                  {isOwner && (
                    <button
                      onClick={() => handleRemoveStaff(s)}
                      style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer", fontSize: "11px" }}
                    >
                      remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isOwner && (
            <form
              onSubmit={handleAddStaff}
              style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px", marginTop: "14px" }}
            >
              <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 500 }}>Add a staff member</p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  type="text"
                  placeholder="Name"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  style={{ flex: 1, padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                />
                <input
                  type="text"
                  placeholder="Role (e.g. Baker)"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  style={{ flex: 1, padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                />
                <input
                  type="text"
                  placeholder="Shift (e.g. 9am–5pm)"
                  value={newStaff.shift}
                  onChange={(e) => setNewStaff({ ...newStaff, shift: e.target.value })}
                  style={{ flex: 1, padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                <input
                  type="checkbox"
                  checked={newStaff.grantLogin}
                  onChange={(e) => setNewStaff({ ...newStaff, grantLogin: e.target.checked })}
                />
                Also grant them app access (email + password login)
              </label>

              {newStaff.grantLogin && (
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    style={{ flex: 1, padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                  />
                  <input
                    type="password"
                    placeholder="Password (min 6 chars)"
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    style={{ flex: 1, padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={addingStaff}
                style={{ width: "100%", padding: "8px", fontSize: "12px", background: "var(--green)", color: "var(--cream)", border: "none", borderRadius: "6px" }}
              >
                {addingStaff ? "Adding…" : "Add to roster"}
              </button>
            </form>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: "16px", marginBottom: "10px" }}>Task assignments</h2>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 14px", marginBottom: "14px" }}>
            {tasks.map((t, i) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "9px 0",
                  borderBottom: i < tasks.length - 1 ? "1px solid var(--border)" : "none"
                }}
              >
                <button
                  onClick={() => toggleTask(t)}
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 0, fontSize: "13px", color: t.done ? "#2c5c26" : "var(--text-muted)" }}
                  aria-label={t.done ? "Mark not done" : "Mark done"}
                >
                  {t.done ? "✓" : "○"}
                </button>

                {editingTaskId === t.id ? (
                  <div style={{ flex: 1 }}>
                    <input
                      value={taskDraft.description}
                      onChange={(e) => setTaskDraft({ ...taskDraft, description: e.target.value })}
                      style={{ width: "100%", boxSizing: "border-box", fontSize: "12px", padding: "4px 6px", border: "1px solid var(--border)", borderRadius: "4px", marginBottom: "4px" }}
                    />
                    <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                      <select
                        value={taskDraft.assignedTo}
                        onChange={(e) => setTaskDraft({ ...taskDraft, assignedTo: e.target.value })}
                        style={{ flex: 1, fontSize: "12px", padding: "4px 6px", border: "1px solid var(--border)", borderRadius: "4px" }}
                      >
                        {staff.map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                      <input
                        value={taskDraft.due}
                        onChange={(e) => setTaskDraft({ ...taskDraft, due: e.target.value })}
                        placeholder="Due"
                        style={{ width: "80px", fontSize: "12px", padding: "4px 6px", border: "1px solid var(--border)", borderRadius: "4px" }}
                      />
                    </div>
                    <button onClick={() => saveTaskEdit(t.id)} style={{ fontSize: "11px", border: "none", background: "none", color: "var(--green)", cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingTaskId(null)} style={{ fontSize: "11px", border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer", marginLeft: "8px" }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        textDecoration: t.done ? "line-through" : "none",
                        color: t.done ? "var(--text-muted)" : "var(--text-primary)"
                      }}
                    >
                      {t.description}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                      {t.assignedTo} · {t.due}
                      <button
                        onClick={() => startTaskEdit(t)}
                        style={{ marginLeft: "8px", fontSize: "11px", border: "none", background: "none", color: "var(--green)", cursor: "pointer" }}
                      >
                        edit
                      </button>
                      <button
                        onClick={() => handleDeleteTask(t)}
                        style={{ marginLeft: "6px", fontSize: "11px", border: "none", background: "none", color: "var(--red)", cursor: "pointer" }}
                      >
                        delete
                      </button>
                    </p>
                  </div>
                )}
              </div>
            ))}
            {tasks.length === 0 && (
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "12px 0" }}>No tasks yet.</p>
            )}
          </div>

          <form onSubmit={handleAddTask} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 500 }}>Assign a task</p>
            <input
              type="text"
              placeholder="Task"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px", marginBottom: "8px" }}
              required
            />
            <select
              value={newTask.assignedTo}
              onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
              style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px", marginBottom: "8px" }}
              required
            >
              <option value="">Assign to…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Due (e.g. 4:00 PM)"
              value={newTask.due}
              onChange={(e) => setNewTask({ ...newTask, due: e.target.value })}
              style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px", marginBottom: "10px" }}
            />
            <button
              type="submit"
              style={{ width: "100%", padding: "8px", fontSize: "12px", background: "var(--green)", color: "var(--cream)", border: "none", borderRadius: "6px" }}
            >
              Add task
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
