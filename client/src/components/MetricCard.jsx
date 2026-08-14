export default function MetricCard({ label, value, sub, tone = "default" }) {
  const bg = tone === "warning" ? "var(--kraft-light)" : "var(--surface-1)";
  const subColor = tone === "warning" ? "var(--red)" : "var(--text-secondary)";

  return (
    <div
      style={{
        background: bg,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "16px"
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: "13px", color: "var(--text-secondary)" }}>{label}</p>
      <p style={{ margin: 0, fontSize: "26px", fontFamily: "var(--font-display)" }}>{value}</p>
      {sub && <p style={{ margin: "6px 0 0", fontSize: "12px", color: subColor }}>{sub}</p>}
    </div>
  );
}
