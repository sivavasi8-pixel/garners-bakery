import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

const POLL_MS = 20000;

const itemsLabel = (items) => (items || []).map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(", ");

function OrderCard({ order, action }) {
  const nearbyCount = order.nearbyOrderIds?.length || 0;
  return (
    <div className={`dd-card${order.priority ? " dd-card-priority" : ""}`}>
      <div className="dd-card-head">
        <span className="dd-card-id">
          {order.priority && <i className="ti ti-flame" aria-hidden="true" title="Priority" />} Order #{order.id}
        </span>
        {order.distanceFromStoreKm != null ? (
          <span className="dd-distance">{order.distanceFromStoreKm} km from shop</span>
        ) : (
          <span className="dd-distance muted">Distance unknown</span>
        )}
      </div>
      <p className="dd-name">{order.customerName}</p>
      <p className="dd-address">{order.deliveryAddress}</p>
      <p className="dd-items">{itemsLabel(order.items)}</p>
      {nearbyCount > 0 && (
        <p className="dd-nearby">
          <i className="ti ti-map-pins" aria-hidden="true" /> {nearbyCount} other order{nearbyCount > 1 ? "s" : ""} within 1km — worth picking up together
        </p>
      )}
      <div className="dd-meta">
        <a className="dd-tel" href={`tel:${(order.customerPhone || "").replace(/[^\d+]/g, "")}`}>
          <i className="ti ti-phone" aria-hidden="true" /> {order.customerPhone || "No phone on file"}
        </a>
        {order.deliveryLat != null && order.deliveryLng != null && (
          <a
            className="dd-map"
            href={`https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="ti ti-map-pin" aria-hidden="true" /> Navigate
          </a>
        )}
      </div>
      {order.paymentStatus !== "paid" && (
        <p className="dd-cod">Collect ₹{order.total} ({order.paymentMethod === "cash" ? "cash" : order.paymentMethod})</p>
      )}
      {action}
    </div>
  );
}

export default function DeliveryDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = () =>
    Promise.all([api.getAvailableDeliveries(), api.getMyDeliveries()])
      .then(([a, m]) => {
        setAvailable(a.orders);
        setMine(m.orders);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const handleClaim = async (id) => {
    setBusyId(id);
    setError(null);
    try {
      await api.claimDelivery(id);
      await load();
    } catch (err) {
      setError(err.message);
      await load(); // someone else likely claimed it — refresh the list either way
    } finally {
      setBusyId(null);
    }
  };

  const handleRelease = async (id) => {
    if (!window.confirm("Give this delivery back to the available list?")) return;
    setBusyId(id);
    try {
      await api.releaseDelivery(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelivered = async (id) => {
    setBusyId(id);
    try {
      await api.markDelivered(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleLogout = () => {
    if (!window.confirm("Log out of your account?")) return;
    logout();
    navigate("/login");
  };

  return (
    <div className="dd-root">
      <header className="dd-header">
        <div>
          <p className="dd-brand">GARNERS</p>
          <p className="dd-sub">Delivery · {user?.name}</p>
        </div>
        <button className="dd-logout" onClick={handleLogout}>Log out</button>
      </header>

      <main className="dd-main">
        {error && <p className="dd-error">{error}</p>}

        <section>
          <h2 className="dd-section-title">My deliveries{mine.length > 0 ? ` (${mine.length})` : ""}</h2>
          {!loaded ? (
            <p className="dd-empty">Loading…</p>
          ) : mine.length === 0 ? (
            <p className="dd-empty">Nothing claimed yet — pick one up from the list below.</p>
          ) : (
            <div className="dd-list">
              {mine.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  action={
                    <div className="dd-actions">
                      <button className="dd-btn solid" disabled={busyId === o.id} onClick={() => handleDelivered(o.id)}>
                        {busyId === o.id ? "…" : "Mark delivered"}
                      </button>
                      <button className="dd-btn" disabled={busyId === o.id} onClick={() => handleRelease(o.id)}>
                        Give back
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="dd-section-title">Available{available.length > 0 ? ` (${available.length})` : ""}</h2>
          {!loaded ? (
            <p className="dd-empty">Loading…</p>
          ) : available.length === 0 ? (
            <p className="dd-empty">Nothing waiting right now — check back soon.</p>
          ) : (
            <div className="dd-list">
              {available.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  action={
                    <div className="dd-actions">
                      <button className="dd-btn solid" disabled={busyId === o.id} onClick={() => handleClaim(o.id)}>
                        {busyId === o.id ? "…" : "Pick up"}
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <style>{`
        .dd-root { min-height: 100vh; background: var(--a-bg); }
        .dd-header {
          position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px; background: var(--a-sidebar); color: #faf8f3;
        }
        .dd-brand { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 18px; letter-spacing: 0.1em; }
        .dd-sub { margin: 2px 0 0; font-size: 12px; color: var(--a-sidebar-text); }
        .dd-logout { border: 1px solid rgba(250,248,243,0.4); background: none; color: #faf8f3; padding: 8px 14px; border-radius: 8px; font-size: 13px; }

        .dd-main { max-width: 640px; margin: 0 auto; padding: 18px 16px 40px; display: flex; flex-direction: column; gap: 28px; }
        .dd-section-title { font-size: 15px; margin: 0 0 12px; color: var(--a-text-primary); }
        .dd-empty { font-size: 13px; color: var(--a-text-secondary); }
        .dd-error { font-size: 13px; color: var(--a-danger-text); background: var(--a-danger-bg); padding: 10px 12px; border-radius: 8px; }

        .dd-list { display: flex; flex-direction: column; gap: 12px; }
        .dd-card { background: var(--a-panel); border: 1px solid var(--a-border); border-radius: var(--a-radius, 12px); padding: 14px 16px; }
        .dd-card-priority { border: 2px solid #c94f1a; padding: 13px 15px; }
        .dd-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .dd-card-id { font-weight: 700; font-size: 13px; color: var(--a-text-secondary); display: flex; align-items: center; gap: 4px; }
        .dd-card-id i { color: #c94f1a; }
        .dd-nearby { margin: 0 0 10px; font-size: 12.5px; font-weight: 600; color: var(--a-green); display: flex; align-items: center; gap: 5px; }
        .dd-distance { font-size: 12px; font-weight: 700; color: var(--a-green); background: var(--a-green-soft); padding: 2px 8px; border-radius: 999px; }
        .dd-distance.muted { color: var(--a-text-muted); background: var(--a-panel-sunk); }
        .dd-name { margin: 6px 0 2px; font-weight: 700; font-size: 15px; }
        .dd-address { margin: 0 0 4px; font-size: 13px; color: var(--a-text-secondary); overflow-wrap: anywhere; }
        .dd-items { margin: 0 0 10px; font-size: 13px; color: var(--a-text-primary); }
        .dd-meta { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 8px; }
        .dd-tel, .dd-map { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: var(--a-green); text-decoration: none; }
        .dd-cod { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--a-warning-text, #92400e); }
        .dd-actions { display: flex; gap: 8px; }
        .dd-btn {
          flex: 1; min-height: 42px; border-radius: 10px; border: 1px solid var(--a-border); background: var(--a-panel);
          color: var(--a-text-primary); font-weight: 600; font-size: 14px;
        }
        .dd-btn.solid { background: var(--a-green); color: #fff; border: none; }
      `}</style>
    </div>
  );
}
