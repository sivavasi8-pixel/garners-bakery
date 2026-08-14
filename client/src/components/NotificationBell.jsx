import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const severityStyle = {
  critical: { bg: "#f4d9d5", fg: "var(--red)" },
  warning: { bg: "#f3e0b8", fg: "#7a5613" },
  info: { bg: "var(--surface-2)", fg: "var(--text-secondary)" }
};

const POLL_MS = 30000;

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .getNotifications()
        .then((d) => {
          if (!cancelled) {
            setItems(d.items);
            setCount(d.count);
          }
        })
        .catch(() => {}); // notifications are best-effort — a failed poll shouldn't surface an error banner

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        style={{
          position: "relative",
          border: "1px solid rgba(246,241,228,0.4)",
          background: "transparent",
          color: "var(--cream)",
          borderRadius: "8px",
          padding: "6px 10px",
          fontSize: "14px",
          cursor: "pointer"
        }}
      >
        🔔
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "var(--red)",
              color: "var(--cream)",
              borderRadius: "999px",
              fontSize: "10px",
              lineHeight: "16px",
              minWidth: "16px",
              textAlign: "center",
              padding: "0 3px"
            }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "320px",
            maxHeight: "360px",
            overflowY: "auto",
            background: "var(--surface-1)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            zIndex: 20
          }}
        >
          <p style={{ margin: 0, padding: "10px 14px", fontSize: "13px", fontWeight: 500, borderBottom: "1px solid var(--border)" }}>
            Notifications
          </p>
          {items.length === 0 ? (
            <p style={{ margin: 0, padding: "16px 14px", fontSize: "13px", color: "var(--text-secondary)" }}>
              Nothing to flag right now.
            </p>
          ) : (
            items.map((item) => {
              const tone = severityStyle[item.severity] || severityStyle.info;
              return (
                <div
                  key={item.id}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-start"
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: tone.fg, marginTop: "5px", flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 500 }}>{item.title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-secondary)" }}>{item.detail}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
