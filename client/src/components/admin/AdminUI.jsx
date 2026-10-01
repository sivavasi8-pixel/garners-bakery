export function AdminPage({ eyebrow, title, actions, children }) {
  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
          <h1 className="admin-title">{title}</h1>
        </div>
        {actions && <div className="admin-page-actions">{actions}</div>}
      </div>
      {children}
      <style>{`
        .admin-content { padding: 20px 16px; max-width: 1320px; padding-bottom: calc(var(--a-tabbar-h) + 28px); }
        @media (min-width: 900px) { .admin-content { padding: 30px 36px 40px; } }
        .admin-page-head {
          display: flex; justify-content: space-between; align-items: flex-end;
          flex-wrap: wrap; gap: 12px; margin-bottom: 22px;
        }
        .admin-eyebrow { margin: 0 0 4px; font-size: 14px; color: var(--a-text-secondary); }
        .admin-title { font-size: 30px; font-family: var(--font-display); font-weight: 600; margin: 0; line-height: 1.1; }
        @media (min-width: 900px) { .admin-title { font-size: 34px; } }
        .admin-page-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      `}</style>
    </div>
  );
}

export function StatGrid({ columns = 4, children }) {
  return (
    <div className="admin-stat-grid" style={{ "--cols": columns }}>
      {children}
      <style>{`
        .admin-stat-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 22px;
        }
        @media (min-width: 760px) {
          .admin-stat-grid { grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 16px; }
        }
      `}</style>
    </div>
  );
}

// tone: undefined (neutral), "warn" (needs attention) or "danger" (money/stock at risk).
// `warn` stays supported as a boolean for pages written before tones existed.
export function StatCard({ label, value, sub, warn, tone }) {
  const t = tone || (warn ? "warn" : undefined);
  return (
    <div className="admin-stat-card">
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value">{value}</p>
      {sub && <p className={`admin-stat-sub${t ? ` ${t}` : ""}`}>{sub}</p>}
      <style>{`
        .admin-stat-card {
          background: var(--a-panel); border: 1px solid var(--a-border); border-radius: var(--a-radius-lg);
          padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; min-width: 0;
        }
        .admin-stat-label { margin: 0; font-size: 13px; font-weight: 600; color: var(--a-text-secondary); }
        .admin-stat-value { margin: 0; font-size: 30px; line-height: 1; font-family: var(--font-display); font-weight: 600; }
        .admin-stat-sub { margin: 0; font-size: 13px; color: var(--a-text-secondary); }
        .admin-stat-sub.warn { color: var(--a-warning-text); font-weight: 600; }
        .admin-stat-sub.danger { color: var(--a-danger-text); font-weight: 600; }
      `}</style>
    </div>
  );
}

// Covers every status value the real app uses across orders, staff, and inventory
// (see StatusBadge.jsx, the customer-facing equivalent of this component).
const pillMap = {
  placed: { bg: "var(--a-neutral-bg)", fg: "var(--a-neutral-text)", label: "New" },
  baking: { bg: "var(--a-warning-bg)", fg: "var(--a-warning-text)", label: "Baking" },
  ready: { bg: "var(--a-success-bg)", fg: "var(--a-success-text)", label: "Ready" },
  delivered: { bg: "var(--a-neutral-bg)", fg: "var(--a-neutral-text)", label: "Done" },
  cancelled: { bg: "var(--a-danger-bg)", fg: "var(--a-danger-text)", label: "Cancelled" },
  clocked_in: { bg: "var(--a-success-bg)", fg: "var(--a-success-text)", label: "In" },
  clocked_out: { bg: "var(--a-neutral-bg)", fg: "var(--a-neutral-text)", label: "Out" },
  on_break: { bg: "var(--a-warning-bg)", fg: "var(--a-warning-text)", label: "Break" },
  absent: { bg: "var(--a-danger-bg)", fg: "var(--a-danger-text)", label: "Absent" },
  in_stock: { bg: "var(--a-success-bg)", fg: "var(--a-success-text)", label: "In stock" },
  low_stock: { bg: "var(--a-warning-bg)", fg: "var(--a-warning-text)", label: "Low" },
  out_of_stock: { bg: "var(--a-danger-bg)", fg: "var(--a-danger-text)", label: "Out of stock" },
  paid: { bg: "var(--a-success-bg)", fg: "var(--a-success-text)", label: "Paid" },
  unpaid: { bg: "var(--a-danger-bg)", fg: "var(--a-danger-text)", label: "Unpaid" }
};

export function StatusPill({ status, label }) {
  const p = pillMap[status] || { bg: "var(--a-neutral-bg)", fg: "var(--a-neutral-text)", label: status };
  return (
    <span
      style={{
        fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap",
        background: p.bg, color: p.fg, display: "inline-block"
      }}
    >
      {label || p.label}
    </span>
  );
}

export function ListPanel({ title, action, children }) {
  return (
    <div style={{ background: "var(--a-panel)", border: "1px solid var(--a-border)", borderRadius: "var(--a-radius-lg)", overflow: "hidden" }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--a-border)" }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 700 }}>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function ListRow({ children, style }) {
  return (
    <div className="admin-list-row" style={style}>
      {children}
      <style>{`
        .admin-list-row {
          display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;
          padding: 13px 18px; border-bottom: 1px solid var(--a-border-soft);
        }
        .admin-list-row:last-child { border-bottom: none; }
      `}</style>
    </div>
  );
}
