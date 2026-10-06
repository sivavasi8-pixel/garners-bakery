import { useEffect, useState } from "react";
import { api } from "../api";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upiVpa, setUpiVpa] = useState("");
  const [upiPayeeName, setUpiPayeeName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setUpiVpa(s.upiVpa || "");
        setUpiPayeeName(s.upiPayeeName || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.updateSettings({ upiVpa, upiPayeeName });
      setSaved(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: "32px", color: "var(--a-text-secondary)" }}>Loading…</div>;
  if (error) return <div style={{ padding: "32px", color: "var(--a-danger-text)" }}>{error}</div>;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 560 }}>
      <h1 style={{ fontSize: "22px", marginBottom: "4px" }}>Settings</h1>
      <p style={{ color: "var(--a-text-secondary)", fontSize: "13px", marginBottom: "24px" }}>
        Shop-wide configuration — not code, so it's safe to update any time your details change.
      </p>

      <form
        onSubmit={handleSave}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          padding: "18px 20px",
          border: "1px solid var(--a-border)",
          borderRadius: "var(--a-radius-lg, 16px)",
          background: "var(--a-panel)"
        }}
      >
        <h2 style={{ margin: 0, fontSize: "16px" }}>Payment · UPI</h2>
        <p style={{ margin: "-8px 0 0", fontSize: "12.5px", color: "var(--a-text-secondary)" }}>
          Customers paying by UPI see a QR code and a direct pay link built from this. Leave it blank to hide the UPI
          pay option on checkout and My Orders.
        </p>

        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "13.5px", fontWeight: 600 }}>UPI ID (VPA)</span>
          <input
            type="text"
            value={upiVpa}
            onChange={(e) => setUpiVpa(e.target.value)}
            placeholder="yourshop@okhdfcbank"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "13.5px", fontWeight: 600 }}>
            Payee name shown in the customer's UPI app <span style={{ fontWeight: 400, color: "var(--a-text-secondary)" }}>· optional</span>
          </span>
          <input
            type="text"
            value={upiPayeeName}
            onChange={(e) => setUpiPayeeName(e.target.value)}
            placeholder="GARNERS Cakes"
            style={inputStyle}
          />
        </label>

        {saveError && <p style={{ color: "var(--a-danger-text)", fontSize: "13px", margin: 0 }}>{saveError}</p>}
        {saved && <p style={{ color: "var(--a-green)", fontSize: "13px", margin: 0 }}>✓ Saved.</p>}

        <button type="submit" disabled={saving} style={submitBtn}>
          {saving ? "Saving…" : "Save payment settings"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  minHeight: "44px",
  padding: "9px 13px",
  fontSize: "14px",
  border: "1px solid var(--a-border)",
  borderRadius: "10px",
  boxSizing: "border-box"
};

const submitBtn = {
  alignSelf: "flex-start",
  padding: "10px 20px",
  fontSize: "14px",
  fontWeight: 600,
  border: "none",
  borderRadius: "10px",
  background: "var(--a-green)",
  color: "#fff",
  cursor: "pointer"
};
