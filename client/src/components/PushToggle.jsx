import { useState } from "react";
import { enablePush, disablePush, isPushEnabled } from "../push";

// Dropped into both nav shells (admin sidebar/mobile panel, customer topbar)
// and the customer's My Orders page. className carries an ambient shell's own
// item styling when one is passed; a default pill style covers standalone use
// (e.g. My Orders) where no such class exists.
const defaultStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: 600,
  border: "1px solid var(--border)",
  borderRadius: "999px",
  background: "none",
  color: "var(--text-secondary)",
  cursor: "pointer"
};

export default function PushToggle({ className, iconClass = "ti-bell" }) {
  const [enabled, setEnabled] = useState(isPushEnabled);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    if (enabled) {
      await disablePush();
      setEnabled(false);
    } else {
      const res = await enablePush();
      if (res.ok) {
        setEnabled(true);
      } else {
        alert(res.error);
      }
    }
    setBusy(false);
  };

  return (
    <button
      className={className}
      style={className ? undefined : defaultStyle}
      onClick={handleClick}
      disabled={busy}
      type="button"
    >
      <i className={`ti ${enabled ? "ti-bell-ringing" : iconClass}`} aria-hidden="true" />
      <span>{busy ? "…" : enabled ? "Notifications on" : "Enable notifications"}</span>
    </button>
  );
}
