import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";

const statusOptions = ["placed", "baking", "ready", "delivered", "cancelled"];

const itemsLabel = (items) =>
  items
    .map((it) => `${it.name}${it.qty > 1 ? ` x${it.qty}` : ""}${it.note ? ` — "${it.note}"` : ""}`)
    .join(", ");

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editingPickupId, setEditingPickupId] = useState(null);
  const [pickupDraft, setPickupDraft] = useState("");

  const load = () => api.getOrders().then((d) => setOrders(d.orders)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const runAction = async (fn) => {
    setActionError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleStatusChange = (id, status) => runAction(() => api.updateOrderStatus(id, status));
  const markPaid = (id) => runAction(() => api.updateOrderPayment(id, "paid"));
  const handleCancel = (order) => {
    if (!confirm(`Cancel order #${order.id}? Any deducted stock will be restocked.`)) return;
    runAction(() => api.cancelOrder(order.id));
  };

  const startPickupEdit = (order) => {
    setEditingPickupId(order.id);
    setPickupDraft(order.pickupTime || "");
  };
  const savePickup = (id) =>
    runAction(async () => {
      await api.updateOrderPickupTime(id, pickupDraft);
      setEditingPickupId(null);
    });

  if (error) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load orders: {error}</p>;
  if (!orders) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading orders…</p>;

  const q = search.trim().toLowerCase();
  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (!q) return true;
    return o.customerName.toLowerCase().includes(q) || String(o.id).includes(q);
  });

  return (
    <div style={{ padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Orders</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
        {orders.length} total. Search by customer name or order #.
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
        <input
          type="text"
          placeholder="Search customer or order #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: "8px 10px", fontSize: "13px", border: "1px solid var(--border)", borderRadius: "8px" }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 10px", fontSize: "13px", border: "1px solid var(--border)", borderRadius: "8px" }}
        >
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {actionError && <p style={{ fontSize: "13px", color: "var(--red)", marginBottom: "14px" }}>{actionError}</p>}

      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {filtered.map((o, i) => (
          <div
            key={o.id}
            style={{
              padding: "12px 14px",
              background: "var(--surface-1)",
              borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "13px" }}>
                  #{o.id} · {o.customerName}{" "}
                  <Link to={`/receipt/${o.id}`} style={{ fontSize: "11px", color: "var(--green)" }}>receipt</Link>
                </p>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                  {itemsLabel(o.items)} · ₹{o.total}
                </p>

                {editingPickupId === o.id ? (
                  <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                    <input
                      value={pickupDraft}
                      onChange={(e) => setPickupDraft(e.target.value)}
                      style={{ fontSize: "12px", padding: "2px 6px", border: "1px solid var(--border)", borderRadius: "4px" }}
                    />
                    <button onClick={() => savePickup(o.id)} style={{ fontSize: "11px", border: "none", background: "none", color: "var(--green)", cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingPickupId(null)} style={{ fontSize: "11px", border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>Cancel</button>
                  </div>
                ) : (
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                    Pickup: {o.pickupTime || "—"}
                    <button
                      onClick={() => startPickupEdit(o)}
                      style={{ marginLeft: "6px", fontSize: "11px", border: "none", background: "none", color: "var(--green)", cursor: "pointer" }}
                    >
                      edit
                    </button>
                  </p>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {o.paymentStatus === "paid" ? (
                    <span style={{ fontSize: "11px", color: "#2c5c26" }}>paid ({o.paymentMethod})</span>
                  ) : (
                    <button
                      onClick={() => markPaid(o.id)}
                      style={{ fontSize: "11px", padding: "3px 8px", border: "1px solid var(--border-strong)", borderRadius: "6px", background: "var(--surface-1)" }}
                    >
                      Mark paid
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <StatusBadge status={o.status} />
                  {o.status !== "delivered" && o.status !== "cancelled" && (
                    <>
                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        style={{ fontSize: "12px", padding: "4px 6px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      >
                        {statusOptions.filter((s) => s !== "cancelled").map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleCancel(o)}
                        style={{ fontSize: "11px", border: "none", background: "none", color: "var(--red)", cursor: "pointer" }}
                      >
                        cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ padding: "14px", fontSize: "13px", color: "var(--text-secondary)" }}>No orders match.</p>
        )}
      </div>
    </div>
  );
}
