import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";

const itemsLabel = (items) =>
  items
    .map((it) => `${it.name}${it.qty > 1 ? ` x${it.qty}` : ""}${it.note ? ` — "${it.note}"` : ""}`)
    .join(", ");

const statusOptions = ["placed", "baking", "ready", "delivered"];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [markingId, setMarkingId] = useState(null);

  const load = () => api.getDashboardSummary().then(setSummary).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const markPaid = async (id) => {
    setMarkingId(id);
    try {
      await api.updateOrderPayment(id, "paid");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setMarkingId(null);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateOrderStatus(id, status);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load dashboard: {error}</p>;
  if (!summary) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading dashboard…</p>;

  return (
    <div style={{ padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Owner dashboard</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
        A snapshot of today at GARNERS.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
          marginBottom: "28px"
        }}
      >
        <MetricCard label="Today's revenue" value={`₹${summary.todaysRevenue.toLocaleString()}`} />
        <MetricCard label="Orders today" value={summary.ordersToday} sub={`${summary.pendingOrders} pending`} />
        <MetricCard
          label="Staff on shift"
          value={summary.staffOnShift}
          sub={`of ${summary.staffTotal} total`}
        />
        <MetricCard
          label="Low stock items"
          value={summary.lowStockCount}
          sub={summary.lowStockCount ? "needs reorder" : "all good"}
          tone={summary.lowStockCount ? "warning" : "default"}
        />
      </div>

      <div className="split-2col" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "20px" }}>
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h2 style={{ fontSize: "16px" }}>Order queue</h2>
            <Link to="/orders" style={{ fontSize: "12px", color: "var(--green)" }}>View all orders →</Link>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            {summary.recentOrders.map((o, i) => (
              <div
                key={o.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "var(--surface-1)",
                  borderBottom: i < summary.recentOrders.length - 1 ? "1px solid var(--border)" : "none",
                  gap: "10px"
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "13px" }}>
                    #{o.id} · {o.customerName}{" "}
                    <Link to={`/receipt/${o.id}`} style={{ fontSize: "11px", color: "var(--green)" }}>receipt</Link>
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                    {itemsLabel(o.items)} · {o.pickupTime}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {o.paymentStatus === "paid" ? (
                    <span style={{ fontSize: "11px", color: "#2c5c26" }}>paid</span>
                  ) : (
                    <button
                      onClick={() => markPaid(o.id)}
                      disabled={markingId === o.id}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        border: "1px solid var(--border-strong)",
                        borderRadius: "6px",
                        background: "var(--surface-1)"
                      }}
                    >
                      {markingId === o.id ? "…" : "Mark paid"}
                    </button>
                  )}
                  {o.status === "delivered" || o.status === "cancelled" ? (
                    <StatusBadge status={o.status} />
                  ) : (
                    <select
                      value={o.status}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                      style={{ fontSize: "12px", padding: "4px 6px", border: "1px solid var(--border)", borderRadius: "6px" }}
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: "16px", marginBottom: "10px" }}>Low stock</h2>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            {summary.lowStockItems.length === 0 && (
              <p style={{ padding: "14px", fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                Everything's stocked.
              </p>
            )}
            {summary.lowStockItems.map((item, i) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--surface-1)",
                  borderBottom: i < summary.lowStockItems.length - 1 ? "1px solid var(--border)" : "none"
                }}
              >
                <span style={{ fontSize: "13px" }}>{item.name}</span>
                <span style={{ fontSize: "12px", color: "var(--red)" }}>
                  {item.quantity} {item.unit} left
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
