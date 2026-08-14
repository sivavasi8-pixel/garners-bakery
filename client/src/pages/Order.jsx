import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

const categories = [
  { id: "breads", label: "Breads" },
  { id: "cookies", label: "Cookies" },
  { id: "cakes", label: "Cakes" },
  { id: "custom", label: "Custom order" }
];

const paymentOptions = [
  { id: "cash", label: "Cash on pickup" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" }
];

const fieldStyle = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "13px",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  marginBottom: "10px",
  boxSizing: "border-box"
};

function CustomCakeForm({ pricePerKg, onAdd }) {
  const [size, setSize] = useState("1");
  const [flavor, setFlavor] = useState("");
  const [message, setMessage] = useState("");
  const [neededBy, setNeededBy] = useState("");

  const price = Math.round((pricePerKg || 0) * (Number(size) || 0));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!flavor || !size) return;
    onAdd({ size: Number(size), flavor, message, neededBy, price });
    setSize("1");
    setFlavor("");
    setMessage("");
    setNeededBy("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px", background: "var(--surface-1)" }}
    >
      <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 500 }}>Design your cake</p>
      <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
        ₹{pricePerKg}/kg — decorated, baked to order.
      </p>

      <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Size (kg)</label>
      <input type="number" min="0.5" step="0.5" value={size} onChange={(e) => setSize(e.target.value)} style={fieldStyle} required />

      <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Flavor</label>
      <input
        type="text"
        placeholder="e.g. Chocolate truffle, Red velvet"
        value={flavor}
        onChange={(e) => setFlavor(e.target.value)}
        style={fieldStyle}
        required
      />

      <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Message on cake (optional)</label>
      <input
        type="text"
        placeholder="e.g. Happy Birthday Aanya!"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        style={fieldStyle}
      />

      <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Needed by</label>
      <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} style={fieldStyle} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
        <span style={{ fontSize: "13px", fontWeight: 500 }}>₹{price || 0}</span>
        <button
          type="submit"
          style={{ padding: "8px 16px", fontSize: "13px", background: "var(--green)", color: "var(--cream)", border: "none", borderRadius: "8px" }}
        >
          Add to order
        </button>
      </div>
    </form>
  );
}

export default function Order() {
  const [menu, setMenu] = useState(null);
  const [activeCategory, setActiveCategory] = useState("breads");
  const [cart, setCart] = useState([]);
  const [error, setError] = useState(null);
  const [pickupTime, setPickupTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const { user } = useAuth();
  const canOrder = user && user.role === "customer";

  useEffect(() => {
    api.getMenu().then((d) => setMenu(d.items)).catch((e) => setError(e.message));
  }, []);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { ...item, qty: 1, menuItemId: item.id }];
    });
  };

  const addCustomCake = (customItemId) => ({ size, flavor, message, neededBy, price }) => {
    const note = [message, neededBy ? `Needed by ${neededBy}` : null].filter(Boolean).join(" — ");
    setCart((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        menuItemId: customItemId,
        name: `Custom cake — ${flavor}, ${size}kg`,
        price,
        qty: 1,
        note
      }
    ]);
  };

  const total = cart.reduce((sum, c) => sum + (c.price || 0) * c.qty, 0);

  const handleCheckout = async () => {
    setCheckoutError(null);
    setPlacing(true);
    try {
      const order = await api.createOrder({
        items: cart.map((c) => ({ menuItemId: c.menuItemId, name: c.name, qty: c.qty, price: c.price, note: c.note })),
        total,
        pickupTime: pickupTime || "Not specified",
        channel: "online",
        paymentMethod
      });
      setPlacedOrder(order.order);
      setCart([]);
      setPickupTime("");
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  if (error) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load menu: {error}</p>;
  if (!menu) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading menu…</p>;

  const shown = menu.filter((m) => m.category === activeCategory);
  const customCakeItem = menu.find((m) => m.category === "custom");

  return (
    <div style={{ padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Order online</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
        Store pick up · oven fresh daily bakes.
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

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px" }}>
        {activeCategory === "custom" ? (
          customCakeItem ? (
            <CustomCakeForm pricePerKg={customCakeItem.price} onAdd={addCustomCake(customCakeItem.id)} />
          ) : (
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Custom cakes aren't available right now.</p>
          )
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignContent: "start" }}>
            {shown.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "14px",
                  background: "var(--surface-1)",
                  opacity: item.inStock ? 1 : 0.6
                }}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{
                      width: "100%",
                      height: 70,
                      borderRadius: "8px",
                      marginBottom: "10px",
                      objectFit: "cover"
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 70,
                      borderRadius: "8px",
                      background: "var(--surface-2)",
                      marginBottom: "10px"
                    }}
                  />
                )}
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>{item.name}</p>
                <p style={{ margin: "3px 0 10px", fontSize: "12px", color: "var(--text-secondary)" }}>
                  {item.description}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 500 }}>
                    {item.price ? `₹${item.price}` : "made to order"}
                  </span>
                  {!item.inStock ? (
                    <span style={{ fontSize: "12px", color: "var(--red)" }}>Sold out</span>
                  ) : (
                    item.price && (
                      <button
                        onClick={() => addToCart(item)}
                        style={{
                          padding: "5px 12px",
                          fontSize: "12px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "6px",
                          background: "var(--surface-1)"
                        }}
                      >
                        Add
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
            {shown.length === 0 && (
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Nothing in this category yet.</p>
            )}
          </div>
        )}

        <aside>
          <h2 style={{ fontSize: "16px", marginBottom: "10px" }}>Your order</h2>

          {placedOrder ? (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 500 }}>
                Order #{placedOrder.id} placed!
              </p>
              <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--text-secondary)" }}>
                Status: {placedOrder.status} · Pickup: {placedOrder.pickupTime} · Payment:{" "}
                {placedOrder.paymentStatus === "paid" ? "paid" : "pay on pickup"}
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
                View / print receipt
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
                Place another order
              </button>
            </div>
          ) : (
            <>
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 14px", marginBottom: "14px" }}>
                {cart.length === 0 && (
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "12px 0" }}>
                    Your cart is empty.
                  </p>
                )}
                {cart.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "9px 0",
                      borderBottom: i < cart.length - 1 ? "1px solid var(--border)" : "none",
                      fontSize: "13px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{c.name}{c.qty > 1 ? ` x${c.qty}` : ""}</span>
                      <span>₹{c.price * c.qty}</span>
                    </div>
                    {c.note && (
                      <p style={{ margin: "3px 0 0", fontSize: "11px", color: "var(--text-secondary)" }}>{c.note}</p>
                    )}
                  </div>
                ))}
              </div>

              {cart.length > 0 && (
                <>
                  <input
                    type="text"
                    placeholder="Pickup time (e.g. 5:00 PM today)"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    style={fieldStyle}
                  />
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={fieldStyle}>
                    {paymentOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Total</span>
                <span style={{ fontSize: "16px", fontWeight: 500 }}>₹{total}</span>
              </div>

              {checkoutError && (
                <p style={{ fontSize: "12px", color: "var(--red)", marginBottom: "10px" }}>{checkoutError}</p>
              )}

              {canOrder ? (
                <button
                  onClick={handleCheckout}
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
                  {placing ? "Placing order…" : "Checkout"}
                </button>
              ) : (
                cart.length > 0 && (
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    <Link to="/login" state={{ from: "/order" }} style={{ color: "var(--green)" }}>Log in</Link>
                    {" "}or{" "}
                    <Link to="/signup" style={{ color: "var(--green)" }}>create an account</Link>
                    {" "}to check out — your cart stays right here.
                  </p>
                )
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
