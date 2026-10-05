import { useEffect, useState } from "react";
import { api } from "../api";

export default function DeliveryPartners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState(null);

  const load = () =>
    api
      .getDeliveryPartners()
      .then(({ partners }) => setPartners(partners))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await api.createDeliveryPartner(form);
      setForm({ name: "", email: "", phone: "", password: "" });
      await load();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this delivery partner's login?")) return;
    setRowError(null);
    setBusyId(id);
    try {
      await api.deleteDeliveryPartner(id);
      setPartners((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setRowError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div style={{ padding: "32px", color: "var(--a-text-secondary)" }}>Loading…</div>;
  if (error) return <div style={{ padding: "32px", color: "var(--a-danger-text)" }}>{error}</div>;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 720 }}>
      <h1 style={{ fontSize: "22px", marginBottom: "4px" }}>Delivery partners</h1>
      <p style={{ color: "var(--a-text-secondary)", fontSize: "13px", marginBottom: "24px" }}>
        Accounts that can log in separately to claim and deliver "ready" delivery orders.
      </p>

      <form
        onSubmit={handleCreate}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "28px",
          padding: "16px",
          border: "1px solid var(--a-border)",
          borderRadius: "var(--a-radius, 10px)",
          background: "var(--a-panel)"
        }}
      >
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          style={inputStyle}
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
          style={inputStyle}
        />
        <input
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password (8+ chars)"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
          minLength={8}
          style={inputStyle}
        />
        <button type="submit" disabled={creating} style={submitBtn}>
          {creating ? "Adding…" : "Add partner"}
        </button>
        {createError && <p style={{ color: "var(--a-danger-text)", fontSize: "13px", margin: 0, flexBasis: "100%" }}>{createError}</p>}
      </form>

      {rowError && <p style={{ color: "var(--a-danger-text)", fontSize: "13px" }}>{rowError}</p>}

      {partners.length === 0 ? (
        <p style={{ color: "var(--a-text-secondary)", fontSize: "13px" }}>No delivery partners yet — add one above.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--a-border)" }}>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Name</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Email</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Phone</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}></th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--a-border)" }}>
                  <td style={{ padding: "10px" }}>{p.name}</td>
                  <td style={{ padding: "10px", color: "var(--a-text-secondary)" }}>{p.email}</td>
                  <td style={{ padding: "10px", color: "var(--a-text-secondary)" }}>{p.phone || "—"}</td>
                  <td style={{ padding: "10px" }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={busyId === p.id}
                      style={{ border: "none", background: "none", color: "var(--a-danger-text)", fontSize: "12px", cursor: "pointer" }}
                    >
                      {busyId === p.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  flex: "1 1 160px",
  minWidth: 140,
  padding: "8px 11px",
  fontSize: "13px",
  border: "1px solid var(--a-border)",
  borderRadius: "6px",
  boxSizing: "border-box"
};

const submitBtn = {
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--a-green)",
  color: "#fff",
  cursor: "pointer"
};
