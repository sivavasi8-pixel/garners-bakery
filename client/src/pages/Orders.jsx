import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { AdminPage, StatusPill } from "../components/admin/AdminUI";
import { ZONES } from "../deliveryZones";
import { nextStep } from "../orderSteps";

const statusOptions = ["placed", "baking", "ready", "delivered", "cancelled"];
const REFRESH_MS = 30000;

// Fetches the receipt image (needs the auth header, so a plain <a href> can't
// serve it directly) and opens it in a new tab — simplest way to review one
// without building a whole image-viewer modal for something staff glance at once.
function ReceiptButton({ orderId }) {
  const [busy, setBusy] = useState(false);
  const handleClick = async () => {
    setBusy(true);
    try {
      const blob = await api.getReceiptBlob(orderId);
      window.open(URL.createObjectURL(blob), "_blank", "noopener");
    } catch {
      // the thumbnail link is a nice-to-have — a failed fetch just does nothing
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="a-btn quiet" disabled={busy} onClick={handleClick}>
      <i className="ti ti-receipt" aria-hidden="true" /> {busy ? "Opening…" : "View receipt"}
    </button>
  );
}

const zoneLabel = (id) => ZONES.find((z) => z.id === id)?.label || id;
const deliveryFeeLabel = (o) => {
  if (o.deliveryFee === null) return "fee TBC (Porter)";
  if (o.deliveryFee === 0) return "free delivery";
  return `₹${o.deliveryFee} delivery fee`;
};
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const istDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const itemsLabel = (items) =>
  items
    .map((it) => `${it.qty > 1 ? `${it.qty} × ` : ""}${it.name}`)
    .join(", ");

const COLUMNS = [
  { status: "placed", title: "New", color: "#8a8474" },
  { status: "baking", title: "Baking", color: "#c98a1a" },
  { status: "ready", title: "Ready", color: "#2f7a3b" },
  { status: "done", title: "Done today", color: "#1f3d2e" }
];
const CHANNEL_FILTERS = [
  { id: "all", label: "All" },
  { id: "online", label: "Online" },
  { id: "in-store", label: "In-store" },
  { id: "delivery", label: "Delivery" }
];

function OrderCard({ o, busy, onAdvance, onPaid, onCancel, onTogglePriority }) {
  const [confirming, setConfirming] = useState(false);
  const next = nextStep(o);
  const notes = o.items.filter((it) => it.note).map((it) => it.note);
  const finished = o.status === "delivered" || o.status === "cancelled";
  return (
    <article className={`board-card${o.status === "cancelled" ? " cancelled" : ""}`}>
      <div className="board-card-head">
        <span className="board-card-title">
          {o.priority && <i className="ti ti-flame" title="Priority" style={{ color: "#c94f1a", marginRight: 4 }} aria-hidden="true" />}
          #{o.id} · {o.customerName}
        </span>
        <span className="board-card-when">{o.pickupTime || "—"}</span>
      </div>
      <p className="board-card-items">{itemsLabel(o.items)}</p>
      {notes.map((n, i) => <p key={i} className="board-card-note">“{n}”</p>)}
      <div className="board-tags">
        <span className="board-tag">
          {o.deliveryType === "delivery" ? `Delivery · ${zoneLabel(o.deliveryZone)}` : o.channel === "in-store" ? "In-store" : "Pickup"}
        </span>
        {o.status === "cancelled" ? (
          <StatusPill status="cancelled" />
        ) : o.paymentStatus === "paid" ? (
          <StatusPill status="paid" label={o.paymentMethod ? `Paid · ${o.paymentMethod}` : "Paid"} />
        ) : (
          <StatusPill status="unpaid" label={o.paymentMethod === "cash" ? "Cash due" : o.paymentMethod ? `${o.paymentMethod.toUpperCase()} · confirm` : "Unpaid"} />
        )}
      </div>
      {(o.customerPhone || (o.deliveryType === "delivery" && o.deliveryAddress)) && (
        <p className="board-card-contact">
          {o.customerPhone && <a href={`tel:${o.customerPhone.replace(/[^\d+]/g, "")}`} className="board-tel">{o.customerPhone}</a>}
          {o.deliveryType === "delivery" && o.deliveryAddress && <span>{o.deliveryAddress} · {deliveryFeeLabel(o)}</span>}
          {o.deliveryLat != null && o.deliveryLng != null && (
            <a href={`https://www.google.com/maps?q=${o.deliveryLat},${o.deliveryLng}`} target="_blank" rel="noopener noreferrer" className="board-tel">
              <i className="ti ti-map-pin" aria-hidden="true" /> Map
            </a>
          )}
        </p>
      )}
      <div className="board-card-foot">
        <span className="board-card-total">{money(o.total)}</span>
        <div className="board-card-actions">
          {!finished && o.deliveryType === "delivery" && (
            <button type="button" className="a-btn quiet" disabled={busy} onClick={() => onTogglePriority(!o.priority)}>
              {o.priority ? "Unmark urgent" : "Mark urgent"}
            </button>
          )}
          {!finished && o.paymentStatus !== "paid" && o.hasReceipt && <ReceiptButton orderId={o.id} />}
          {!finished && o.paymentStatus !== "paid" && (
            <button type="button" className="a-btn quiet" disabled={busy} onClick={onPaid}>Mark paid</button>
          )}
          {next && (
            <button type="button" className="a-btn primary" disabled={busy} onClick={() => onAdvance(next.status)}>
              {busy ? "Saving…" : next.label}
            </button>
          )}
        </div>
      </div>
      {!finished && (
        <div className="board-card-more">
          <Link to={`/receipt/${o.id}`} className="admin-link-btn">Receipt</Link>
          {confirming ? (
            <span className="board-confirm">
              Return stock and cancel?
              <button type="button" className="admin-link-btn danger" onClick={() => { setConfirming(false); onCancel(); }}>Yes, cancel</button>
              <button type="button" className="admin-link-btn muted" onClick={() => setConfirming(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="admin-link-btn danger" onClick={() => setConfirming(true)}>Cancel order</button>
          )}
        </div>
      )}
    </article>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [view, setView] = useState("board");
  const [channel, setChannel] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [editingPickupId, setEditingPickupId] = useState(null);
  const [pickupDraft, setPickupDraft] = useState("");

  const load = () => api.getOrders().then((d) => setOrders(d.orders)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // New online orders show up without a manual refresh.
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const runAction = async (id, fn) => {
    setActionError(null);
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const startPickupEdit = (order) => {
    setEditingPickupId(order.id);
    setPickupDraft(order.pickupTime || "");
  };
  const savePickup = (id) =>
    runAction(id, async () => {
      await api.updateOrderPickupTime(id, pickupDraft);
      setEditingPickupId(null);
    });

  if (error) return <AdminPage title="Orders"><p style={{ color: "var(--a-danger-text)" }}>Couldn't load orders: {error}. Refresh to try again.</p></AdminPage>;
  if (!orders) return <AdminPage title="Orders"><p style={{ color: "var(--a-text-secondary)" }}>Loading…</p></AdminPage>;

  const q = search.trim().toLowerCase();
  const matches = (o) => {
    if (q && !(o.customerName.toLowerCase().includes(q) || String(o.id).includes(q) || (o.customerPhone || "").replace(/\s/g, "").includes(q.replace(/\s/g, "")))) return false;
    if (channel === "online" && o.channel !== "online") return false;
    if (channel === "in-store" && o.channel !== "in-store") return false;
    if (channel === "delivery" && o.deliveryType !== "delivery") return false;
    return true;
  };
  const today = istDay(Date.now());
  const columnOrders = (status) =>
    orders.filter(matches).filter((o) =>
      status === "done" ? (o.status === "delivered" || o.status === "cancelled") && istDay(o.createdAt) === today : o.status === status
    );

  const listed = orders.filter(matches).filter((o) => statusFilter === "all" || o.status === statusFilter);

  const actionsFor = (o) => ({
    busy: busyId === o.id,
    onAdvance: (status) => runAction(o.id, () => api.updateOrderStatus(o.id, status)),
    onPaid: () => runAction(o.id, () => api.updateOrderPayment(o.id, "paid")),
    onCancel: () => runAction(o.id, () => api.cancelOrder(o.id)),
    onTogglePriority: (priority) => runAction(o.id, () => api.updateOrderPriority(o.id, priority))
  });

  return (
    <AdminPage
      eyebrow={new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" })}
      title="Orders"
      actions={
        <div className="view-toggle" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "board"} className={view === "board" ? "on" : ""} onClick={() => setView("board")}>Board</button>
          <button type="button" aria-pressed={view === "list"} className={view === "list" ? "on" : ""} onClick={() => setView("list")}>All orders</button>
        </div>
      }
    >
      <div className="admin-filters">
        <label className="admin-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            id="orders-search"
            placeholder="Name, order # or phone"
            aria-label="Search orders"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="chip-row" role="group" aria-label="Filter by channel">
          {CHANNEL_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={channel === f.id} className={`filter-chip${channel === f.id ? " on" : ""}`} onClick={() => setChannel(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        {view === "list" && (
          <select className="admin-select-sm" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {actionError && <p className="orders-error" role="alert">{actionError}</p>}

      {view === "board" ? (
        <div className="board">
          {COLUMNS.map((col) => {
            const list = columnOrders(col.status);
            return (
              <section key={col.status} className="board-col" aria-labelledby={`col-${col.status}`}>
                <div className="board-col-head">
                  <h2 id={`col-${col.status}`}>
                    <span className="board-dot" style={{ background: col.color }} aria-hidden="true" />
                    {col.title}
                  </h2>
                  <span className="board-count">{list.length}</span>
                </div>
                {list.map((o) => <OrderCard key={o.id} o={o} {...actionsFor(o)} />)}
                {list.length === 0 && (
                  <p className="board-empty">
                    {col.status === "placed" ? "New orders land here." : col.status === "done" ? "Collected and delivered orders land here." : "Nothing here right now."}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Order</th><th>Items</th><th>Total</th><th>When</th><th>Payment</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>
                      {o.priority && <i className="ti ti-flame" title="Priority" style={{ color: "#c94f1a", marginRight: 4 }} aria-hidden="true" />}
                      #{o.id}
                    </b><br />
                    {o.customerName}
                    {o.customerPhone && <><br /><a href={`tel:${o.customerPhone.replace(/[^\d+]/g, "")}`} className="board-tel">{o.customerPhone}</a></>}
                    <br /><Link to={`/receipt/${o.id}`} className="admin-receipt-link">Receipt</Link>
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    {itemsLabel(o.items)}
                    {o.items.filter((it) => it.note).map((it, i) => <div key={i} className="muted">“{it.note}”</div>)}
                  </td>
                  <td>{money(o.total)}</td>
                  <td style={{ minWidth: 170 }}>
                    <div className="muted" style={{ fontWeight: 600 }}>{o.deliveryType === "delivery" ? "Delivery" : "Pickup"}</div>
                    {editingPickupId === o.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          id={`pickup-${o.id}`}
                          aria-label="Pickup time"
                          value={pickupDraft}
                          onChange={(e) => setPickupDraft(e.target.value)}
                          className="admin-pickup-input"
                        />
                        <button type="button" onClick={() => savePickup(o.id)} className="admin-link-btn">Save</button>
                        <button type="button" onClick={() => setEditingPickupId(null)} className="admin-link-btn muted">Cancel</button>
                      </div>
                    ) : (
                      <span>
                        {o.pickupTime || "—"}
                        <button type="button" onClick={() => startPickupEdit(o)} className="admin-link-btn" style={{ marginLeft: 8 }}>Edit</button>
                      </span>
                    )}
                    {o.deliveryType === "delivery" && (
                      <div className="muted" style={{ overflowWrap: "anywhere" }}>
                        {zoneLabel(o.deliveryZone)} · {deliveryFeeLabel(o)}<br />
                        {o.deliveryAddress}
                        {o.deliveryLat != null && o.deliveryLng != null && (
                          <>
                            {" · "}
                            <a href={`https://www.google.com/maps?q=${o.deliveryLat},${o.deliveryLng}`} target="_blank" rel="noopener noreferrer">
                              Map
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {o.paymentStatus === "paid" ? (
                      <StatusPill status="paid" label={o.paymentMethod ? `Paid · ${o.paymentMethod}` : "Paid"} />
                    ) : o.status === "cancelled" ? (
                      <span className="muted">—</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        {o.hasReceipt && <ReceiptButton orderId={o.id} />}
                        <button type="button" onClick={() => runAction(o.id, () => api.updateOrderPayment(o.id, "paid"))} className="admin-btn-xs">Mark paid</button>
                      </div>
                    )}
                  </td>
                  <td><StatusPill status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {listed.length === 0 && <p className="board-empty" style={{ margin: 16 }}>No orders match. Try clearing the search or filters.</p>}
        </div>
      )}

      <style>{`
        .view-toggle { display: inline-flex; background: var(--a-panel-sunk); border-radius: 12px; padding: 4px; gap: 4px; }
        .view-toggle button {
          min-height: 38px; padding: 0 16px; border: 0; border-radius: 9px; background: transparent;
          color: var(--a-text-secondary); font: 600 14px var(--font-body);
        }
        .view-toggle button.on { background: var(--a-panel); color: var(--a-green); box-shadow: 0 1px 2px rgba(38,36,31,0.12); }

        .admin-filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 18px; }
        .admin-search {
          flex: 1 1 240px; max-width: 360px; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px;
          border: 1px solid var(--a-border); border-radius: 12px; background: var(--a-panel); color: var(--a-text-secondary);
        }
        .admin-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: 400 14px var(--font-body); color: var(--a-text-primary); }
        .admin-search:focus-within { border-color: var(--a-green); }
        .chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .filter-chip {
          min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--a-border);
          background: var(--a-panel); color: var(--a-text-primary); font: 600 14px var(--font-body);
        }
        .filter-chip.on { background: var(--a-green); border-color: var(--a-green); color: #faf8f3; }
        .orders-error { color: var(--a-danger-text); font-weight: 600; margin: 0 0 14px; }

        .board { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (min-width: 760px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1200px) { .board { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .board-col { background: var(--a-panel-sunk); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
        .board-col-head { display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; }
        .board-col-head h2 { margin: 0; font: 700 15px var(--font-body); display: flex; align-items: center; gap: 8px; }
        .board-dot { width: 10px; height: 10px; border-radius: 5px; }
        .board-count { font-size: 13px; font-weight: 700; color: var(--a-text-secondary); }
        .board-empty {
          margin: 0; padding: 18px 10px; text-align: center; font-size: 13px; color: var(--a-text-secondary);
          border: 1px dashed var(--a-border); border-radius: 12px;
        }

        .board-card {
          background: var(--a-panel); border: 1px solid var(--a-border); border-radius: 12px; padding: 14px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .board-card.cancelled { opacity: 0.7; }
        .board-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
        .board-card-title { font-weight: 700; font-size: 15px; }
        .board-card-when { font-size: 13px; font-weight: 600; text-align: right; }
        .board-card-items { margin: 0; font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; }
        .board-card-note {
          margin: 0; font-size: 13px; font-style: italic; color: #6b4a32; background: #f3e9d7; border-radius: 8px; padding: 6px 8px;
        }
        .board-tags { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .board-tag { font-size: 12px; font-weight: 600; color: var(--a-neutral-text); background: var(--a-neutral-bg); border-radius: 6px; padding: 4px 8px; }
        .board-card-contact { margin: 0; font-size: 13px; color: var(--a-text-secondary); display: flex; flex-direction: column; gap: 2px; overflow-wrap: anywhere; }
        .board-card-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
        .board-card-total { font-weight: 700; font-size: 15px; }
        .board-card-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .board-card-more { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--a-border-soft); margin-top: 2px; }
        .board-tel { color: var(--a-green); font-weight: 600; text-decoration: none; }
        .board-confirm { display: inline-flex; gap: 10px; align-items: center; font-size: 13px; flex-wrap: wrap; }

        .admin-table-wrap { background: var(--a-panel); border: 1px solid var(--a-border); border-radius: var(--a-radius-lg); overflow-x: auto; }
        .admin-data-table { width: 100%; font-size: 14px; }
        .admin-data-table th { text-align: left; padding: 12px 14px; font-weight: 600; font-size: 13px; color: var(--a-text-secondary); border-bottom: 1px solid var(--a-border); white-space: nowrap; }
        .admin-data-table td { padding: 12px 14px; border-bottom: 1px solid var(--a-border-soft); vertical-align: top; line-height: 1.45; }
        .admin-data-table tr:last-child td { border-bottom: none; }
        .admin-data-table .muted { color: var(--a-text-secondary); font-size: 13px; }
        .admin-receipt-link { font-size: 13px; font-weight: 600; color: var(--a-green); }
        .admin-pickup-input { min-height: 36px; font-size: 14px; padding: 0 8px; border: 1px solid var(--a-border); border-radius: 8px; width: 160px; }
        .admin-link-btn { border: none; background: none; color: var(--a-green); cursor: pointer; font-size: 13px; font-weight: 600; padding: 8px 0; }
        .admin-link-btn.muted { color: var(--a-text-muted); }
        .admin-link-btn.danger { color: var(--a-danger-text); }
      `}</style>
    </AdminPage>
  );
}
