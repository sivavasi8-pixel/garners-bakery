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

  const [shopAddress, setShopAddress] = useState("");
  const [shopLat, setShopLat] = useState(null);
  const [shopLng, setShopLng] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSaveError, setLocationSaveError] = useState(null);
  const [locationSaved, setLocationSaved] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setUpiVpa(s.upiVpa || "");
        setUpiPayeeName(s.upiPayeeName || "");
        setShopAddress(s.shopAddress || "");
        setShopLat(s.shopLat ? Number(s.shopLat) : null);
        setShopLng(s.shopLng ? Number(s.shopLng) : null);
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

  const handleUseLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocError("Location isn't supported in this browser — you can still save just the address below.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setShopLat(pos.coords.latitude);
        setShopLng(pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocError("Couldn't get your location — check site permissions, or just save the address below.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    setLocationSaveError(null);
    setLocationSaved(false);
    setSavingLocation(true);
    try {
      const payload = { shopAddress };
      // Only send lat/lng if "Use my current location" actually set them —
      // otherwise the server forward-geocodes the typed address itself.
      if (shopLat != null && shopLng != null) {
        payload.shopLat = shopLat;
        payload.shopLng = shopLng;
      }
      const updated = await api.updateSettings(payload);
      setShopLat(updated.shopLat ? Number(updated.shopLat) : null);
      setShopLng(updated.shopLng ? Number(updated.shopLng) : null);
      setLocationSaved(true);
    } catch (err) {
      setLocationSaveError(err.message);
    } finally {
      setSavingLocation(false);
    }
  };

  if (loading) return <div style={{ padding: "32px", color: "var(--a-text-secondary)" }}>Loading…</div>;
  if (error) return <div style={{ padding: "32px", color: "var(--a-danger-text)" }}>{error}</div>;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 560, display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1 style={{ fontSize: "22px", marginBottom: "4px" }}>Settings</h1>
        <p style={{ color: "var(--a-text-secondary)", fontSize: "13px" }}>
          Shop-wide configuration — not code, so it's safe to update any time your details change.
        </p>
      </div>

      <form onSubmit={handleSaveLocation} style={panelStyle}>
        <h2 style={{ margin: 0, fontSize: "16px" }}>Shop location</h2>
        <p style={{ margin: "-8px 0 0", fontSize: "12.5px", color: "var(--a-text-secondary)" }}>
          Used on the poster and to calculate "distance from store" on the delivery dashboard.
        </p>

        <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "13.5px", fontWeight: 600 }}>Address</span>
          <textarea
            value={shopAddress}
            onChange={(e) => setShopAddress(e.target.value)}
            placeholder="Shop name, street, area, city"
            rows={2}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </label>

        <button type="button" onClick={handleUseLocation} disabled={locating} style={locateBtn}>
          <i className="ti ti-current-location" aria-hidden="true" />
          {locating ? "Getting your location…" : "Use my current location"}
        </button>
        {locError && <p style={{ color: "var(--a-danger-text)", fontSize: "12.5px", margin: 0 }}>{locError}</p>}
        {shopLat != null && shopLng != null ? (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--a-text-secondary)" }}>
            Pinned at {shopLat.toFixed(5)}, {shopLng.toFixed(5)}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--a-text-secondary)" }}>
            No precise pin yet — saving just finds an approximate location from the address above. Use the button
            while you're physically at the shop for an exact pin.
          </p>
        )}

        {locationSaveError && <p style={{ color: "var(--a-danger-text)", fontSize: "13px", margin: 0 }}>{locationSaveError}</p>}
        {locationSaved && <p style={{ color: "var(--a-green)", fontSize: "13px", margin: 0 }}>✓ Saved.</p>}

        <button type="submit" disabled={savingLocation} style={submitBtn}>
          {savingLocation ? "Saving…" : "Save shop location"}
        </button>
      </form>

      <form onSubmit={handleSave} style={panelStyle}>
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

const panelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  padding: "18px 20px",
  border: "1px solid var(--a-border)",
  borderRadius: "var(--a-radius-lg, 16px)",
  background: "var(--a-panel)"
};

const inputStyle = {
  minHeight: "44px",
  padding: "9px 13px",
  fontSize: "14px",
  border: "1px solid var(--a-border)",
  borderRadius: "10px",
  boxSizing: "border-box"
};

const locateBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  minHeight: "44px",
  border: "1px solid var(--a-border)",
  borderRadius: "10px",
  background: "var(--a-bg)",
  color: "var(--a-text-primary)",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer"
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
