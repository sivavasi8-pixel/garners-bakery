import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";

const emptyForm = { name: "", unit: "", quantity: "", reorderLevel: "", supplier: "" };

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "13px",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  marginBottom: "10px",
  boxSizing: "border-box"
};

export default function Inventory() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [qtyDrafts, setQtyDrafts] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const load = () =>
    api
      .getInventory()
      .then((data) => setItems(data.items))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const saveQuantity = async (id) => {
    const raw = qtyDrafts[id];
    if (raw === undefined || raw === "") return;
    setActionError(null);
    try {
      await api.updateInventoryQuantity(id, Number(raw));
      setQtyDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel,
      supplier: item.supplier || ""
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.unit) return;
    setSaving(true);
    setActionError(null);
    const payload = {
      name: form.name,
      unit: form.unit,
      quantity: form.quantity === "" ? undefined : Number(form.quantity),
      reorderLevel: form.reorderLevel === "" ? undefined : Number(form.reorderLevel),
      supplier: form.supplier
    };
    try {
      if (editingId) {
        await api.updateInventoryItem(editingId, payload);
      } else {
        await api.createInventoryItem({ ...payload, quantity: payload.quantity || 0, reorderLevel: payload.reorderLevel || 0 });
      }
      resetForm();
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Remove "${item.name}" from inventory? This also drops it from any recipe that uses it.`)) return;
    setActionError(null);
    try {
      await api.deleteInventoryItem(item.id);
      if (editingId === item.id) resetForm();
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (error) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load inventory: {error}</p>;
  if (!items) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading inventory…</p>;

  const lowStock = items.filter((i) => i.status !== "in_stock").length;
  const outOfStock = items.filter((i) => i.status === "out_of_stock").length;
  const sorted = [...items].sort((a, b) => {
    const order = { out_of_stock: 0, low_stock: 1, in_stock: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div style={{ padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Inventory</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
        {items.length} ingredients tracked.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
          marginBottom: "24px"
        }}
      >
        <MetricCard label="Total items" value={items.length} />
        <MetricCard label="Low stock" value={lowStock} tone={lowStock ? "warning" : "default"} />
        <MetricCard label="Out of stock" value={outOfStock} tone={outOfStock ? "warning" : "default"} />
      </div>

      {actionError && <p style={{ fontSize: "13px", color: "var(--red)", marginBottom: "14px" }}>{actionError}</p>}

      <div className="split-2col" style={{ display: "grid", gridTemplateColumns: isOwner ? "1fr 320px" : "1fr", gap: "24px" }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {sorted.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                background: "var(--surface-1)",
                borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none",
                gap: "10px"
              }}
            >
              <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                <p style={{ margin: 0, fontSize: "13px" }}>{item.name}</p>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                  Reorder level: {item.reorderLevel} {item.unit} · {item.supplier}
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "13px" }}>
                    {item.quantity} {item.unit} left
                  </p>
                  <StatusBadge status={item.status} />
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder={item.quantity}
                  value={qtyDrafts[item.id] ?? ""}
                  onChange={(e) => setQtyDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                  style={{ width: "60px", padding: "5px 6px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                />
                <button
                  onClick={() => saveQuantity(item.id)}
                  style={{ padding: "5px 10px", fontSize: "11px", border: "1px solid var(--border-strong)", borderRadius: "6px", background: "var(--surface-1)" }}
                >
                  Set
                </button>
                {isOwner && (
                  <>
                    <button
                      onClick={() => startEdit(item)}
                      style={{ padding: "5px 10px", fontSize: "11px", border: "1px solid var(--border-strong)", borderRadius: "6px", background: "var(--surface-1)" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      style={{ padding: "5px 10px", fontSize: "11px", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--surface-1)", color: "var(--red)" }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p style={{ padding: "14px", fontSize: "13px", color: "var(--text-secondary)" }}>
              No ingredients yet{isOwner ? " — add one to the right." : "."}
            </p>
          )}
        </div>

        {isOwner && (
          <form
            onSubmit={handleSubmit}
            style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", alignSelf: "start" }}
          >
            <h2 style={{ fontSize: "15px", marginBottom: "12px" }}>{editingId ? "Edit ingredient" : "Add ingredient"}</h2>

            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
              required
            />
            <input
              type="text"
              placeholder="Unit (e.g. kg, l)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              style={inputStyle}
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Quantity in stock"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              style={inputStyle}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Reorder level"
              value={form.reorderLevel}
              onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Supplier"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              style={inputStyle}
            />

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="submit"
                disabled={saving}
                style={{ flex: 1, padding: "9px", fontSize: "13px", background: "var(--green)", color: "var(--cream)", border: "none", borderRadius: "8px" }}
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Add ingredient"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{ padding: "9px 14px", fontSize: "13px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "8px" }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
