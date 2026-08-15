import { useEffect, useState } from "react";
import { api } from "../api";
import { AdminPage, ListPanel, ListRow } from "../components/admin/AdminUI";

const categories = ["breads", "cookies", "pastries", "cakes", "custom"];
// Rendered with a distinct label so it's clear this isn't a normal browsing category —
// items here only ever show in the customer-facing "Today's Specials" strip.
const specialCategory = { value: "special", label: "⭐ Today's special (not on regular menu)" };

const emptyForm = { name: "", category: "breads", price: "", unit: "", description: "" };

function RecipeEditor({ item, inventory, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getRecipe(item.id)
      .then((d) => setRows(d.ingredients.map((r) => ({ inventoryId: r.inventoryId, qtyPerUnit: r.qtyPerUnit }))))
      .catch((e) => setError(e.message));
  }, [item.id]);

  const updateRow = (i, field, value) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
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
    <div className="admin-recipe-editor">
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 500 }}>
        Recipe for {item.name} — how much of each ingredient one {item.unit} uses
      </p>
      {rows === null ? (
        <p style={{ fontSize: 12, color: "var(--a-text-secondary)" }}>Loading…</p>
      ) : (
        <>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <select value={row.inventoryId} onChange={(e) => updateRow(i, "inventoryId", e.target.value)} className="admin-inline-input" style={{ flex: 2 }}>
                {inventory.map((inv) => <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>)}
              </select>
              <input
                type="number" step="0.001" placeholder="Qty per unit" value={row.qtyPerUnit}
                onChange={(e) => updateRow(i, "qtyPerUnit", e.target.value)}
                className="admin-inline-input" style={{ width: 100 }}
              />
              <button onClick={() => removeRow(i)} className="admin-link-btn danger">✕</button>
            </div>
          ))}
          <button onClick={addRow} type="button" className="admin-btn-xs" style={{ marginBottom: 10 }}>+ Add ingredient</button>
          {error && <p style={{ fontSize: 12, color: "var(--a-danger-text)", marginBottom: 8 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} className="admin-btn-primary" style={{ width: "auto", padding: "6px 14px" }}>
              {saving ? "Saving…" : "Save recipe"}
            </button>
            <button onClick={onClose} type="button" className="admin-btn-secondary" style={{ padding: "6px 14px" }}>Close</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminMenu() {
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
    setForm({ name: item.name, category: item.category, price: item.price ?? "", unit: item.unit, description: item.description || "" });
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

  const toggleSpecial = async (item) => {
    try {
      await api.updateMenuSpecial(item.id, !item.isSpecial);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <AdminPage title="Menu"><p style={{ color: "var(--a-danger-text)" }}>Couldn't load menu: {error}</p></AdminPage>;
  if (!items || !inventory) return <AdminPage title="Menu"><p style={{ color: "var(--a-text-secondary)" }}>Loading…</p></AdminPage>;

  return (
    <AdminPage eyebrow="Add, edit, and photograph what's for sale — this is what customers see on the Order page" title="Menu">
      <div className="admin-two-col">
        <ListPanel>
          {items.map((item) => (
            <div key={item.id}>
              <ListRow>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 220px", minWidth: 0 }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--a-bg)", flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                      {item.name}
                      {!item.inStock && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--a-danger-text)" }}>Sold out</span>}
                      {item.isSpecial && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--a-warning-text)" }}>★ Today's special</span>}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--a-text-secondary)" }}>
                      {item.category} · {item.price ? `₹${item.price}` : "made to order"} / {item.unit}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => toggleSpecial(item)} className={`admin-btn-xs${item.isSpecial ? " gold" : ""}`}>
                    {item.isSpecial ? "★ Remove special" : "☆ Mark as special"}
                  </button>
                  <button onClick={() => toggleAvailability(item)} className="admin-btn-xs">
                    {item.inStock ? "Mark sold out" : "Mark available"}
                  </button>
                  <button onClick={() => setRecipeItemId(recipeItemId === item.id ? null : item.id)} className={`admin-btn-xs${recipeItemId === item.id ? " active" : ""}`}>
                    Recipe
                  </button>
                  <button onClick={() => startEdit(item)} className="admin-btn-xs">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="admin-btn-xs danger">Delete</button>
                </div>
              </ListRow>
              {recipeItemId === item.id && <RecipeEditor item={item} inventory={inventory} onClose={() => setRecipeItemId(null)} />}
            </div>
          ))}
          {items.length === 0 && <p style={{ padding: 14, fontSize: 13, color: "var(--a-text-secondary)" }}>No menu items yet — add one to the right.</p>}
        </ListPanel>

        <form onSubmit={handleSubmit} className="admin-form-panel">
          <p className="admin-section-title">{editingId ? "Edit item" : "Add item"}</p>
          <input className="admin-search" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ marginBottom: 8 }} required />
          <select className="admin-search" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ marginBottom: 8 }}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={specialCategory.value}>{specialCategory.label}</option>
          </select>
          {form.category === specialCategory.value && (
            <p className="admin-note">
              This item won't appear in Breads/Cookies/Cakes — only in "Today's Specials" on the Order page, and only until end of day.
            </p>
          )}
          <input type="number" step="0.01" className="admin-search" placeholder="Price (leave blank for made-to-order)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={{ marginBottom: 8 }} />
          <input className="admin-search" placeholder="Unit (e.g. loaf, piece, box)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={{ marginBottom: 8 }} required />
          <textarea className="admin-search" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ marginBottom: 10, resize: "vertical" }} />
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0] || null)} style={{ marginBottom: 10, fontSize: 12 }} />
          {formError && <p style={{ fontSize: 12, color: "var(--a-danger-text)", marginBottom: 10 }}>{formError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={saving} className="admin-btn-primary" style={{ flex: 1 }}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add item"}
            </button>
            {editingId && <button type="button" onClick={resetForm} className="admin-btn-secondary" style={{ padding: "9px 14px" }}>Cancel</button>}
          </div>
        </form>
      </div>

      <style>{`
        .admin-section-title { font-size: 14px; font-weight: 500; margin-bottom: 10px; }
        .admin-two-col { display: grid; grid-template-columns: 1fr; gap: 18px; }
        @media (min-width: 900px) { .admin-two-col { grid-template-columns: 1.5fr 1fr; } }
        .admin-search { width: 100%; border: 1px solid var(--a-border); border-radius: 6px; padding: 8px 12px; font-size: 13px; font-family: var(--font-body); box-sizing: border-box; }
        .admin-form-panel { background: var(--a-panel); border: 1px solid var(--a-border); border-radius: var(--a-radius); padding: 16px; align-self: start; }
        .admin-btn-primary { padding: 10px; background: var(--a-green); color: #fff; border: none; border-radius: 6px; font-size: 13px; }
        .admin-btn-secondary { background: var(--a-bg); border: 1px solid var(--a-border); border-radius: 6px; font-size: 13px; }
        .admin-btn-xs { border: 1px solid var(--a-border); background: var(--a-panel); border-radius: 6px; padding: 5px 10px; font-size: 11.5px; white-space: nowrap; }
        .admin-btn-xs.danger { color: var(--a-danger-text); }
        .admin-btn-xs.active { background: var(--a-bg); }
        .admin-btn-xs.gold { border-color: var(--a-accent); background: var(--a-warning-bg); color: var(--a-warning-text); font-weight: 600; }
        .admin-note { font-size: 11px; color: var(--a-text-secondary); background: var(--a-bg); border: 1px solid var(--a-border); border-radius: 8px; padding: 8px 10px; margin: -4px 0 10px; }
        .admin-recipe-editor { padding: 12px 14px; background: var(--a-bg); border-top: 1px solid var(--a-border); }
        .admin-inline-input { border: 1px solid var(--a-border); border-radius: 6px; padding: 5px 6px; font-size: 12px; }
        .admin-link-btn { border: none; background: none; color: var(--a-danger-text); cursor: pointer; font-size: 12px; padding: 0; }
      `}</style>
    </AdminPage>
  );
}
