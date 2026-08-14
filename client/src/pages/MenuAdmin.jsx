import { useEffect, useState } from "react";
import { api } from "../api";

const categories = ["breads", "cookies", "pastries", "cakes", "custom"];

const emptyForm = { name: "", category: "breads", price: "", unit: "", description: "" };

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "13px",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  marginBottom: "10px",
  boxSizing: "border-box"
};

function RecipeEditor({ item, inventory, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getRecipe(item.id)
      .then((d) => setRows(d.ingredients.map((r) => ({ inventoryId: r.inventoryId, qtyPerUnit: r.qtyPerUnit }))))
      .catch((e) => setError(e.message));
  }, [item.id]);

  const updateRow = (i, field, value) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const addRow = () => {
    const first = inventory[0];
    if (!first) return;
    setRows((prev) => [...prev, { inventoryId: first.id, qtyPerUnit: "" }]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const ingredients = rows
        .filter((r) => r.inventoryId && r.qtyPerUnit !== "" && Number(r.qtyPerUnit) > 0)
        .map((r) => ({ inventoryId: Number(r.inventoryId), qtyPerUnit: Number(r.qtyPerUnit) }));
      await api.updateRecipe(item.id, ingredients);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}>
      <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 500 }}>
        Recipe for {item.name} — how much of each ingredient one {item.unit} uses
      </p>

      {rows === null ? (
        <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Loading…</p>
      ) : (
        <>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
              <select
                value={row.inventoryId}
                onChange={(e) => updateRow(i, "inventoryId", e.target.value)}
                style={{ flex: 2, padding: "5px 6px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
              >
                {inventory.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                placeholder="Qty per unit"
                value={row.qtyPerUnit}
                onChange={(e) => updateRow(i, "qtyPerUnit", e.target.value)}
                style={{ width: "100px", padding: "5px 6px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
              />
              <button
                onClick={() => removeRow(i)}
                style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer", fontSize: "12px" }}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            onClick={addRow}
            type="button"
            style={{ fontSize: "11px", border: "1px solid var(--border-strong)", background: "var(--surface-1)", borderRadius: "6px", padding: "4px 10px", marginBottom: "10px" }}
          >
            + Add ingredient
          </button>

          {error && <p style={{ fontSize: "12px", color: "var(--red)", marginBottom: "8px" }}>{error}</p>}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: "6px 14px", fontSize: "12px", background: "var(--green)", color: "var(--cream)", border: "none", borderRadius: "6px" }}
            >
              {saving ? "Saving…" : "Save recipe"}
            </button>
            <button
              onClick={onClose}
              type="button"
              style={{ padding: "6px 14px", fontSize: "12px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "6px" }}
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function MenuAdmin() {
  const [items, setItems] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [recipeItemId, setRecipeItemId] = useState(null);

  const load = () => api.getMenu().then((d) => setItems(d.items)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api.getInventory().then((d) => setInventory(d.items)).catch((e) => setError(e.message));
  }, []);

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      price: item.price ?? "",
      unit: item.unit,
      description: item.description || ""
    });
    setImageFile(null);
    setFormError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setFormError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("category", form.category);
      fd.append("price", form.price);
      fd.append("unit", form.unit);
      fd.append("description", form.description);
      if (imageFile) fd.append("image", imageFile);

      if (editingId) {
        await api.updateMenuItem(editingId, fd);
      } else {
        await api.createMenuItem(fd);
      }
      resetForm();
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this item?")) return;
    try {
      await api.deleteMenuItem(id);
      if (editingId === id) resetForm();
      if (recipeItemId === id) setRecipeItemId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleAvailability = async (item) => {
    try {
      await api.updateMenuAvailability(item.id, !item.inStock);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load menu: {error}</p>;
  if (!items || !inventory) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading menu…</p>;

  return (
    <div style={{ padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Menu</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
        Add, edit, and photograph what's for sale — this is what customers see on the Order page.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px" }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {items.map((item, i) => (
            <div key={item.id} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  background: "var(--surface-1)"
                }}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{ width: 48, height: 48, borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "8px",
                      background: "var(--surface-2)",
                      flexShrink: 0
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>
                    {item.name}
                    {!item.inStock && (
                      <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--red)" }}>Sold out</span>
                    )}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                    {item.category} · {item.price ? `₹${item.price}` : "made to order"} / {item.unit}
                  </p>
                </div>
                <button
                  onClick={() => toggleAvailability(item)}
                  style={{
                    padding: "5px 12px",
                    fontSize: "12px",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "6px",
                    background: item.inStock ? "var(--surface-1)" : "var(--kraft-light)"
                  }}
                >
                  {item.inStock ? "Mark sold out" : "Mark available"}
                </button>
                <button
                  onClick={() => setRecipeItemId(recipeItemId === item.id ? null : item.id)}
                  style={{
                    padding: "5px 12px",
                    fontSize: "12px",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "6px",
                    background: recipeItemId === item.id ? "var(--surface-2)" : "var(--surface-1)"
                  }}
                >
                  Recipe
                </button>
                <button
                  onClick={() => startEdit(item)}
                  style={{
                    padding: "5px 12px",
                    fontSize: "12px",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "6px",
                    background: "var(--surface-1)"
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  style={{
                    padding: "5px 12px",
                    fontSize: "12px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    background: "var(--surface-1)",
                    color: "var(--red)"
                  }}
                >
                  Delete
                </button>
              </div>

              {recipeItemId === item.id && (
                <RecipeEditor item={item} inventory={inventory} onClose={() => setRecipeItemId(null)} />
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p style={{ padding: "14px", fontSize: "13px", color: "var(--text-secondary)" }}>
              No menu items yet — add one to the right.
            </p>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", alignSelf: "start" }}
        >
          <h2 style={{ fontSize: "15px", marginBottom: "12px" }}>{editingId ? "Edit item" : "Add item"}</h2>

          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
            required
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            style={inputStyle}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Price (leave blank for made-to-order)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Unit (e.g. loaf, piece, box)"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            style={inputStyle}
            required
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0] || null)}
            style={{ ...inputStyle, border: "none", padding: 0 }}
          />

          {formError && <p style={{ fontSize: "12px", color: "var(--red)", marginBottom: "10px" }}>{formError}</p>}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: "9px",
                fontSize: "13px",
                background: "var(--green)",
                color: "var(--cream)",
                border: "none",
                borderRadius: "8px"
              }}
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Add item"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: "9px 14px",
                  fontSize: "13px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px"
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
