import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";
import PushToggle from "../components/PushToggle";
import PayWithUpi from "../components/PayWithUpi";
import { paymentLabel } from "../paymentLabel";

const ACTIVE = ["placed", "baking", "ready"];
const REFRESH_MS = 30000;

// The steps a customer sees. "ready" means "out for delivery" for a delivery
// order and "ready to collect" for a pickup — same status, different wording.
const stepsFor = (o) => {
  const delivery = o.deliveryType === "delivery";
  return [
    { status: "placed", label: "Order received", note: "We've got it" },
    { status: "baking", label: "Baking", note: "In the oven" },
    { status: "ready", label: delivery ? "Out for delivery" : "Ready to collect", note: delivery ? "On its way to you" : "Come to the counter" },
    { status: "delivered", label: delivery ? "Delivered" : "Collected", note: o.pickupTime || "" }
  ];
};
const ORDER = ["placed", "baking", "ready", "delivered"];

const headline = (o) => {
  const delivery = o.deliveryType === "delivery";
  return {
    placed: "We've got your order.",
    baking: "It's in the oven.",
    ready: delivery ? "It's on its way." : "Ready to collect.",
    delivered: delivery ? "Delivered. Enjoy!" : "Collected. Enjoy!"
  }[o.status] || "Your order";
};

function Tracker({ order, onCancel, cancelling, settings }) {
  const [confirming, setConfirming] = useState(false);
  const steps = stepsFor(order);
  const at = ORDER.indexOf(order.status);
  const awaitingPayment = order.paymentStatus !== "paid" && (order.paymentMethod === "upi" || order.paymentMethod === "card");

  return (
    <article className="track-card">
      <header className="track-head">
        <span className="track-id">Order #{order.id}</span>
        <h2 className="track-title">{headline(order)}</h2>
        <p className="track-when">
          {order.deliveryType === "delivery" ? "Delivery" : "Pickup"} · {order.pickupTime}
        </p>
      </header>

      <ol className="steps">
        {steps.map((s, i) => {
          const state = i < at ? "done" : i === at ? "now" : "next";
          return (
            <li key={s.status} className={`step ${state}`} aria-current={state === "now" ? "step" : undefined}>
              <span className="step-dot" aria-hidden="true" />
              <span className="step-text">
                <span className="step-label">{s.label}</span>
                {s.note && <span className="step-note">{s.note}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {awaitingPayment && (
        <>
          <p className="pay-note">
            <i className="ti ti-clock" aria-hidden="true" />
            <span><b>{order.paymentMethod === "upi" ? "UPI" : "Card"} payment awaiting confirmation.</b> We'll mark it paid once it reaches us.</span>
          </p>
          <PayWithUpi order={order} settings={settings} />
        </>
      )}

      <div className="track-lines">
        {order.items.map((it, i) => (
          <div key={i}>
            <span>{it.qty} × {it.name}{it.note ? ` — “${it.note}”` : ""}</span>
            {it.price !== undefined && <span>₹{(it.price * it.qty).toLocaleString("en-IN")}</span>}
          </div>
        ))}
        {order.deliveryType === "delivery" && (
          <div><span className="muted">Delivery</span><span>{order.deliveryFee === null ? "To be confirmed" : order.deliveryFee ? `₹${order.deliveryFee}` : "Free"}</span></div>
        )}
        <div className="track-total"><span>Total</span><span>₹{Number(order.total).toLocaleString("en-IN")}</span></div>
      </div>

      <div className="track-actions">
        <Link to={`/receipt/${order.id}`} className="btn-soft">View receipt</Link>
        {order.status === "placed" && (
          confirming ? (
            <span className="confirm-cancel">
              <button type="button" className="btn-danger" onClick={() => onCancel(order)} disabled={cancelling}>
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button type="button" className="btn-plain" onClick={() => setConfirming(false)}>Keep order</button>
            </span>
          ) : (
            <button type="button" className="btn-plain danger" onClick={() => setConfirming(true)}>Cancel order</button>
          )
        )}
      </div>
      {order.status !== "placed" && order.status !== "delivered" && (
        <p className="track-help">It's already being made, so it can't be cancelled online. Contact the shop to make changes.</p>
      )}
    </article>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [settings, setSettings] = useState(null);

  const load = () => api.getMyOrders().then((d) => setOrders(d.orders)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api.getSettings().then(setSettings).catch(() => {}); // the UPI pay card just doesn't show if this fails
  }, []);

  // While something is on its way, refresh now and then so the tracker moves on its own.
  const hasActive = orders?.some((o) => ACTIVE.includes(o.status));
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [hasActive]);

  const handleCancel = async (order) => {
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

  if (error) return <p className="page" style={{ color: "var(--red)" }}>Couldn't load your orders: {error}. Please refresh to try again.</p>;
  if (!orders) return <p className="page" style={{ color: "var(--text-secondary)" }}>Loading your orders…</p>;

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const past = orders.filter((o) => !ACTIVE.includes(o.status));

  return (
    <div className="page my-orders">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 className="page-title" style={{ margin: 0 }}>My orders</h1>
        <PushToggle />
      </div>

      {orders.length === 0 && (
        <div className="empty-state">
          <i className="ti ti-shopping-bag" aria-hidden="true" />
          <p>No orders yet. <Link to="/order">Browse the menu</Link> to place your first one.</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="track-list">
          {active.map((o) => (
            <Tracker key={o.id} order={o} onCancel={handleCancel} cancelling={cancellingId === o.id} settings={settings} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="past-title">Earlier orders</h2>
          <div className="order-list">
            {past.map((o) => (
              <div key={o.id} className="order-card">
                <div className="order-card-main">
                  <p className="order-id">#{o.id} · {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                  <p className="order-items">
                    {o.items.map((it) => `${it.name}${it.qty > 1 ? ` × ${it.qty}` : ""}`).join(", ")}
                  </p>
                  <p className={`payment-line${o.paymentStatus === "paid" ? " paid" : ""}`}>{paymentLabel(o)}</p>
                </div>
                <div className="order-card-side">
                  <p className="order-total">₹{Number(o.total).toLocaleString("en-IN")}</p>
                  <StatusBadge status={o.status} />
                  <Link to={`/receipt/${o.id}`} className="receipt-link">Receipt</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .my-orders { max-width: 720px; display: flex; flex-direction: column; gap: 24px; }
        .page-title { font-size: 30px; }

        .empty-state { text-align: center; padding: 56px 20px; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .empty-state i { font-size: 34px; color: var(--wood); }
        .empty-state p { margin: 0; font-size: 15px; }
        .empty-state a { color: var(--green); font-weight: 700; }

        .track-list { display: flex; flex-direction: column; gap: 18px; }
        .track-card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; }
        .track-head { background: var(--green); color: var(--cream); padding: 18px 20px 22px; display: flex; flex-direction: column; gap: 6px; }
        .track-id { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--kraft); }
        .track-title { font-size: 30px; line-height: 1.1; color: var(--cream); }
        .track-when { margin: 0; font-size: 15px; color: var(--on-green-muted); }

        .steps { list-style: none; margin: 0; padding: 22px 22px 6px; display: flex; flex-direction: column; }
        .step { display: flex; gap: 14px; position: relative; padding-bottom: 18px; }
        .step:not(:last-child)::before {
          content: ""; position: absolute; left: 8px; top: 24px; bottom: 2px; width: 2px; background: var(--border-strong);
        }
        .step.done:not(:last-child)::before { background: var(--green); }
        .step-dot {
          width: 18px; height: 18px; border-radius: 9px; flex-shrink: 0; margin-top: 2px; box-sizing: border-box;
          background: var(--surface-1); border: 2px solid var(--border-strong);
        }
        .step.done .step-dot { background: var(--green); border-color: var(--green); }
        .step.now .step-dot { border: 5px solid var(--red); }
        .step-text { display: flex; flex-direction: column; gap: 2px; }
        .step-label { font-size: 16px; font-weight: 700; }
        .step.next .step-label { font-weight: 500; color: var(--text-secondary); }
        .step-note { font-size: 13px; color: var(--text-secondary); }

        .pay-note {
          margin: 0 20px; padding: 12px 14px; border-radius: 12px; background: var(--warning-bg); color: var(--warning-text);
          font-size: 14px; line-height: 1.45; display: flex; gap: 10px; align-items: flex-start;
        }
        .pay-note i { font-size: 18px; margin-top: 1px; }

        .track-lines {
          margin: 16px 20px 0; padding: 14px 16px; border: 1px solid var(--border); border-radius: 14px;
          display: flex; flex-direction: column; gap: 8px; font-size: 14px; background: var(--surface-0);
        }
        .track-lines > div { display: flex; justify-content: space-between; gap: 12px; }
        .track-lines .muted { color: var(--text-secondary); }
        .track-total { border-top: 1px solid var(--border); padding-top: 8px; font-weight: 700; }

        .track-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 16px 20px 6px; }
        .btn-soft {
          min-height: 46px; padding: 0 18px; border-radius: 12px; background: var(--sand); color: var(--text-primary);
          font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; text-decoration: none;
        }
        .btn-plain {
          min-height: 46px; padding: 0 12px; border: 0; background: none; color: var(--text-primary);
          font: 600 14px var(--font-body);
        }
        .btn-plain.danger { color: var(--red); }
        .btn-danger {
          min-height: 46px; padding: 0 16px; border: 0; border-radius: 12px; background: var(--red); color: #fff;
          font: 700 14px var(--font-body);
        }
        .confirm-cancel { display: inline-flex; gap: 6px; align-items: center; }
        .track-help { margin: 0; padding: 4px 20px 18px; font-size: 13px; color: var(--text-secondary); }
        .track-card > :last-child { margin-bottom: 0; }
        .track-actions:last-child { padding-bottom: 18px; }

        .past-title { font-size: 20px; margin-bottom: 12px; }
        .order-list { display: flex; flex-direction: column; gap: 10px; }
        .order-card {
          background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px 16px;
          display: flex; justify-content: space-between; gap: 12px;
        }
        .order-card-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .order-id { margin: 0; font-size: 14px; font-weight: 700; }
        .order-items { margin: 0; font-size: 13.5px; color: var(--text-secondary); }
        .payment-line { margin: 0; font-size: 12.5px; color: var(--red); }
        .payment-line.paid { color: var(--success-text); }
        .order-card-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .order-total { margin: 0; font-size: 15px; font-weight: 700; }
        .receipt-link { font-size: 13px; color: var(--green); font-weight: 600; }
      `}</style>
    </div>
  );
}
