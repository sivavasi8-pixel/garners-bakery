import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";

export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const load = () => api.getMyOrders().then((d) => setOrders(d.orders)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const handleCancel = async (order) => {
    if (!confirm(`Cancel order #${order.id}?`)) return;
    setCancellingId(order.id);
    try {
      await api.cancelOrder(order.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  if (error) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load your orders: {error}</p>;
  if (!orders) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading your orders…</p>;

  return (
    <div style={{ padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>My orders</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
        {orders.length} order{orders.length === 1 ? "" : "s"} placed.
      </p>

      {orders.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          No orders yet — <Link to="/order" style={{ color: "var(--green)" }}>browse the menu</Link> to place one.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {orders.map((o, i) => (
            <div
              key={o.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                background: "var(--surface-1)",
                borderBottom: i < orders.length - 1 ? "1px solid var(--border)" : "none",
                gap: "10px"
              }}
            >
              <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                <p style={{ margin: 0, fontSize: "13px" }}>
                  #{o.id} · {new Date(o.createdAt).toLocaleDateString()}{" "}
                  <Link to={`/receipt/${o.id}`} style={{ fontSize: "11px", color: "var(--green)" }}>receipt</Link>
                </p>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                  {o.items.map((it) => `${it.name}${it.qty > 1 ? ` x${it.qty}` : ""}${it.note ? ` — "${it.note}"` : ""}`).join(", ")} · Pickup: {o.pickupTime}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: o.paymentStatus === "paid" ? "#2c5c26" : "var(--red)" }}>
                  {o.paymentStatus === "paid" ? "Paid" : "Pay on pickup"}{o.paymentMethod ? ` · ${o.paymentMethod}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 500 }}>₹{o.total}</span>
                  <StatusBadge status={o.status} />
                </div>
                {o.status === "placed" && (
                  <button
                    onClick={() => handleCancel(o)}
                    disabled={cancellingId === o.id}
                    style={{ fontSize: "11px", border: "none", background: "none", color: "var(--red)", cursor: "pointer" }}
                  >
                    {cancellingId === o.id ? "Cancelling…" : "Cancel order"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
