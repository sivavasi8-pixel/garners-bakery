import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const categories = [
  { id: "breads", label: "Breads" },
  { id: "cookies", label: "Cookies" },
  { id: "cakes", label: "Cakes" }
];

const paymentOptions = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" }
];

export default function POS() {
  const [menu, setMenu] = useState(null);
  const [activeCategory, setActiveCategory] = useState("breads");
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [error, setError] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  useEffect(() => {
    api.getMenu().then((d) => setMenu(d.items)).catch((e) => setError(e.message));
  }, []);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((c) => c.id !== id));

  const toggleAvailability = async (item) => {
    try {
      await api.updateMenuAvailability(item.id, !item.inStock);
      const d = await api.getMenu();
      setMenu(d.items);
    } catch (err) {
      setError(err.message);
    }
  };

  const total = cart.reduce((sum, c) => sum + (c.price || 0) * c.qty, 0);

  const handleCharge = async () => {
    setError(null);
    setPlacing(true);
    try {
      const order = await api.createOrder({
        items: cart.map((c) => ({ menuItemId: c.id, name: c.name, qty: c.qty, price: c.price })),
        total,
        pickupTime: "Walk-in",
        customerName: customerName || "Walk-in",
        channel: "in-store",
        paymentMethod
      });
      setPlacedOrder(order.order);
      setCart([]);
      setCustomerName("");
      setPaymentMethod("cash");
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  if (error && !menu) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load menu: {error}</p>;
  if (!menu) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading menu…</p>;

  const shown = menu.filter((m) => m.category === activeCategory && m.price);

  return (
    <div style={{ padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>POS — quick order</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
        Ring up a walk-in sale.
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "13px",
              background: activeCategory === c.id ? "var(--green)" : "var(--surface-1)",
              color: activeCategory === c.id ? "var(--cream)" : "var(--text-secondary)"
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="split-2col" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px" }}>
        <div className="split-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignContent: "start" }}>
          {shown.map((item) => (
            <div
              key={item.id}
              style={{
                position: "relative",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "14px",
                background: "var(--surface-1)",
                opacity: item.inStock ? 1 : 0.6
              }}
            >
              <button
                onClick={() => (item.inStock ? addToCart(item) : null)}
                disabled={!item.inStock}
                style={{
                  all: "unset",
                  display: "block",
                  width: "100%",
                  cursor: item.inStock ? "pointer" : "default",
                  boxSizing: "border-box"
                }}
              >
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>{item.name}</p>
                <p style={{ margin: "3px 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                  {item.inStock ? `₹${item.price}` : "Sold out"}
                </p>
              </button>
              <button
                onClick={() => toggleAvailability(item)}
                style={{
                  marginTop: "6px",
                  fontSize: "10px",
                  border: "none",
                  background: "none",
                  color: "var(--green)",
                  cursor: "pointer",
                  padding: 0
                }}
              >
                {item.inStock ? "mark sold out" : "mark available"}
              </button>
            </div>
          ))}
        </div>

        <aside>
          <h2 style={{ fontSize: "16px", marginBottom: "10px" }}>Current sale</h2>

          {placedOrder ? (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 500 }}>
                Order #{placedOrder.id} rung up — ₹{placedOrder.total}
              </p>
              <Link
                to={`/receipt/${placedOrder.id}`}
                style={{
                  display: "block",
                  textAlign: "center",
                  width: "100%",
                  padding: "9px",
                  fontSize: "13px",
                  background: "var(--green)",
                  color: "var(--cream)",
                  borderRadius: "8px",
                  textDecoration: "none",
                  boxSizing: "border-box",
                  marginBottom: "8px"
                }}
              >
                Print receipt
              </Link>
              <button
                onClick={() => setPlacedOrder(null)}
                style={{
                  width: "100%",
                  padding: "9px",
                  fontSize: "13px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "8px"
                }}
              >
                Start next sale
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: "13px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  marginBottom: "12px",
                  boxSizing: "border-box"
                }}
              />

              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 14px", marginBottom: "14px" }}>
                {cart.length === 0 && (
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "12px 0" }}>
                    Tap items to add them.
                  </p>
                )}
                {cart.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "9px 0",
                      borderBottom: i < cart.length - 1 ? "1px solid var(--border)" : "none",
                      fontSize: "13px"
                    }}
                  >
                    <span>{c.name} x{c.qty}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      ₹{c.price * c.qty}
                      <button
                        onClick={() => removeFromCart(c.id)}
                        style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer", fontSize: "12px" }}
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                ))}
              </div>

              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: "13px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  marginBottom: "12px",
                  boxSizing: "border-box"
                }}
              >
                {paymentOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Total</span>
                <span style={{ fontSize: "16px", fontWeight: 500 }}>₹{total}</span>
              </div>

              {error && <p style={{ fontSize: "12px", color: "var(--red)", marginBottom: "10px" }}>{error}</p>}

              <button
                onClick={handleCharge}
                disabled={cart.length === 0 || placing}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "13px",
                  background: cart.length ? "var(--green)" : "var(--surface-2)",
                  color: cart.length ? "var(--cream)" : "var(--text-muted)",
                  border: "none",
                  borderRadius: "8px"
                }}
              >
                {placing ? "Charging…" : "Charge & ring up"}
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
