import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

export default function Receipt() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getOrder(id).then((d) => setOrder(d.order)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load receipt: {error}</p>;
  if (!order) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading receipt…</p>;

  return (
    <div style={{ padding: "28px", maxWidth: "420px", margin: "0 auto" }}>
      <div className="no-print" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between" }}>
        <Link to="/" style={{ fontSize: "13px", color: "var(--green)" }}>← Back</Link>
        <button
          onClick={() => window.print()}
          style={{ padding: "6px 14px", fontSize: "12px", border: "1px solid var(--border-strong)", borderRadius: "8px", background: "var(--surface-1)" }}
        >
          Print
        </button>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "24px", background: "var(--surface-1)" }}>
        <div style={{ textAlign: "center", marginBottom: "18px" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "18px" }}>GARNERS</p>
          <p style={{ margin: "2px 0 0", fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "12px", color: "var(--text-secondary)" }}>
            Cakes &amp; Breads
          </p>
        </div>

        <div style={{ borderTop: "1px dashed var(--border)", borderBottom: "1px dashed var(--border)", padding: "12px 0", marginBottom: "12px", fontSize: "12px", color: "var(--text-secondary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Order #{order.id}</span>
            <span>{new Date(order.createdAt).toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
            <span>{order.customerName}</span>
            <span>{order.channel}</span>
          </div>
        </div>

        {order.items.map((it, i) => (
          <div key={i} style={{ marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span>{it.name}{it.qty > 1 ? ` x${it.qty}` : ""}</span>
              <span>₹{(it.price || 0) * (it.qty || 1)}</span>
            </div>
            {it.note && <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-secondary)" }}>{it.note}</p>}
          </div>
        ))}

        <div style={{ borderTop: "1px dashed var(--border)", marginTop: "10px", paddingTop: "10px", display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 500 }}>
          <span>Total</span>
          <span>₹{order.total}</span>
        </div>

        <div style={{ marginTop: "14px", fontSize: "12px", color: "var(--text-secondary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Payment</span>
            <span>{order.paymentMethod || "—"} · {order.paymentStatus}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
            <span>Status</span>
            <span>{order.status}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
            <span>Pickup</span>
            <span>{order.pickupTime || "—"}</span>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", marginBottom: 0, fontSize: "11px", color: "var(--text-muted)" }}>
          Thank you for shopping at GARNERS!
        </p>
      </div>
    </div>
  );
}
