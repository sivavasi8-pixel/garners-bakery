import { useEffect, useRef, useState } from "react";
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
    <form onSubmit={handleSubmit} className="custom-cake-form">
      <p className="custom-cake-title">Design your cake</p>
      <p className="custom-cake-rate">₹{pricePerKg}/kg — decorated, baked to order.</p>

      <label className="field-label">Size (kg)</label>
      <input type="number" min="0.5" step="0.5" value={size} onChange={(e) => setSize(e.target.value)} className="field-input" required />

      <label className="field-label">Flavor</label>
      <input
        type="text"
        placeholder="e.g. Chocolate truffle, Red velvet"
        value={flavor}
        onChange={(e) => setFlavor(e.target.value)}
        className="field-input"
        required
      />

      <label className="field-label">Message on cake (optional)</label>
      <input
        type="text"
        placeholder="e.g. Happy Birthday Aanya!"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="field-input"
      />

      <label className="field-label">Needed by</label>
      <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className="field-input" />

      <div className="custom-cake-footer">
        <span className="custom-cake-price">₹{price || 0}</span>
        <button type="submit" className="btn-add-cake">Add to order</button>
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
  const cartRef = useRef(null);

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
  const cartCount = cart.reduce((n, c) => n + c.qty, 0);

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

  const scrollToCart = () => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (error) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load menu: {error}</p>;
  if (!menu) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading menu…</p>;

  const shown = menu.filter((m) => m.category === activeCategory);
  const customCakeItem = menu.find((m) => m.category === "custom");
  const specials = menu.filter((m) => m.isSpecial);

  return (
    <div className="page order-page">
      <p className="eyebrow">Store pick up · oven fresh daily bakes</p>
      <h1 className="page-title">Order online</h1>

      {specials.length > 0 && (
        <div className="specials-section">
          <div className="specials-heading">
            <h2>✨ Today's Specials</h2>
            <span>Fresh picks, today only</span>
          </div>
          <div className="specials-grid">
            {specials.map((item) => (
              <div key={item.id} className="special-card">
                <span className="special-ribbon">Today only</span>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="special-photo" />
                ) : (
                  <div className="special-photo special-photo-empty" />
                )}
                <p className="special-name">{item.name}</p>
                <p className="special-desc">{item.description}</p>
                <div className="special-footer">
                  <span className="special-price">{item.price ? `₹${item.price}` : "made to order"}</span>
                  {!item.inStock ? (
                    <span className="sold-out">Sold out</span>
                  ) : (
                    item.price && (
                      <button onClick={() => addToCart(item)} className="btn-add-special">Add</button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="category-scroll">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`chip${activeCategory === c.id ? " chip-active" : ""}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="order-layout">
        {activeCategory === "custom" ? (
          customCakeItem ? (
            <CustomCakeForm pricePerKg={customCakeItem.price} onAdd={addCustomCake(customCakeItem.id)} />
          ) : (
            <p className="empty-note">Custom cakes aren't available right now.</p>
          )
        ) : (
          <div className="product-grid">
            {shown.map((item) => (
              <div key={item.id} className={`product-card${!item.inStock ? " product-card-out" : ""}`}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="product-photo" />
                ) : (
                  <div className="product-photo product-photo-empty">🍞</div>
                )}
                <div className="product-body">
                  <p className="product-name">{item.name}</p>
                  <p className="product-desc">{item.description}</p>
                  <div className="product-footer">
                    <span className="product-price">{item.price ? `₹${item.price}` : "made to order"}</span>
                    {!item.inStock ? (
                      <span className="sold-out">Sold out</span>
                    ) : (
                      item.price && (
                        <button onClick={() => addToCart(item)} className="btn-add">Add</button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
            {shown.length === 0 && (
              <p className="empty-note">Nothing in this category yet.</p>
            )}
          </div>
        )}

        <aside className="cart-panel" ref={cartRef}>
          <h2 className="section-title">Your order</h2>

          {placedOrder ? (
            <div className="placed-order-card">
              <p className="placed-order-title">Order #{placedOrder.id} placed!</p>
              <p className="placed-order-meta">
                Status: {placedOrder.status} · Pickup: {placedOrder.pickupTime} · Payment:{" "}
                {placedOrder.paymentStatus === "paid" ? "paid" : "pay on pickup"}
              </p>
              <Link to={`/receipt/${placedOrder.id}`} className="btn-checkout" style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: "8px" }}>
                View / print receipt
              </Link>
              <button onClick={() => setPlacedOrder(null)} className="btn-secondary">
                Place another order
              </button>
            </div>
          ) : (
            <>
              <div className="cart-list">
                {cart.length === 0 && <p className="empty-note">Your cart is empty.</p>}
                {cart.map((c) => (
                  <div key={c.id} className="cart-row">
                    <div className="cart-row-main">
                      <span>{c.name}{c.qty > 1 ? ` x${c.qty}` : ""}</span>
                      <span>₹{c.price * c.qty}</span>
                    </div>
                    {c.note && <p className="cart-row-note">{c.note}</p>}
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
                    className="field-input"
                  />
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="field-input">
                    {paymentOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </>
              )}

              <div className="cart-total-row">
                <span className="cart-total-label">Total</span>
                <span className="cart-total-value">₹{total}</span>
              </div>

              {checkoutError && <p className="checkout-error">{checkoutError}</p>}

              {canOrder ? (
                <button onClick={handleCheckout} disabled={cart.length === 0 || placing} className="btn-checkout">
                  {placing ? "Placing order…" : "Checkout"}
                </button>
              ) : (
                cart.length > 0 && (
                  <p className="login-prompt">
                    <Link to="/login" state={{ from: "/order" }}>Log in</Link>
                    {" "}or{" "}
                    <Link to="/signup">create an account</Link>
                    {" "}to check out — your cart stays right here.
                  </p>
                )
              )}
            </>
          )}
        </aside>
      </div>

      {/* Mobile sticky summary — tapping it scrolls straight down to the real cart panel below, so
          checkout stays fully usable on mobile instead of needing a separate cart drawer. */}
      {cartCount > 0 && !placedOrder && (
        <button className="mobile-cart-bar" onClick={scrollToCart}>
          <span className="mobile-cart-count">{cartCount} item{cartCount > 1 ? "s" : ""}</span>
          <span className="mobile-cart-total">₹{total}</span>
          <span className="mobile-cart-cta">View cart</span>
        </button>
      )}

      <style>{`
        .eyebrow { margin: 0 0 4px; font-size: 13px; color: var(--text-secondary); }
        .page-title { font-size: 24px; margin-bottom: 20px; }

        .specials-section { margin-bottom: 24px; }
        .specials-heading { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
        .specials-heading h2 { font-size: 15px; margin: 0; }
        .specials-heading span { font-size: 11.5px; color: var(--text-secondary); }
        .specials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
        .special-card {
          position: relative; overflow: hidden; border: 1.5px solid var(--gold);
          border-radius: var(--radius-lg); padding: 12px; background: var(--surface-1);
        }
        .special-ribbon {
          position: absolute; top: 10px; right: -28px; background: var(--gold); color: var(--charcoal);
          font-size: 9.5px; font-weight: 700; letter-spacing: 0.03em; padding: 3px 30px;
          transform: rotate(35deg); text-transform: uppercase;
        }
        .special-photo { width: 100%; height: 68px; border-radius: 9px; margin-bottom: 9px; object-fit: cover; }
        .special-photo-empty { background: var(--surface-2); }
        .special-name { margin: 0; font-size: 13px; font-weight: 600; }
        .special-desc { margin: 3px 0 0; font-size: 11.5px; color: var(--text-secondary); min-height: 30px; }
        .special-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 9px; }
        .special-price { font-size: 13px; font-weight: 600; }
        .btn-add-special {
          padding: 5px 11px; font-size: 11px; border: 1px solid var(--border-strong); border-radius: 6px;
          background: var(--surface-1); color: var(--text-primary);
        }

        .category-scroll {
          display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;
          margin-bottom: 20px; -webkit-overflow-scrolling: touch;
        }
        .category-scroll::-webkit-scrollbar { display: none; }
        .chip {
          flex-shrink: 0; padding: 8px 16px; border-radius: 8px;
          border: 1px solid var(--border); font-size: 13px;
          background: var(--surface-1); color: var(--text-secondary);
          white-space: nowrap;
        }
        .chip-active { background: var(--green); color: var(--cream); border-color: var(--green); }

        .order-layout { display: block; }
        @media (min-width: 860px) {
          .order-layout { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: start; }
        }

        .product-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (min-width: 520px) { .product-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 860px) { .product-grid { grid-template-columns: 1fr 1fr; } }

        .product-card {
          background: var(--surface-1); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 14px;
        }
        .product-card-out { opacity: 0.6; }
        .product-photo { width: 100%; height: 70px; border-radius: 8px; margin-bottom: 10px; object-fit: cover; }
        .product-photo-empty {
          background: var(--surface-2); display: flex; align-items: center; justify-content: center; font-size: 22px;
        }
        .product-name { margin: 0; font-size: 13px; font-weight: 500; }
        .product-desc { margin: 3px 0 10px; font-size: 12px; color: var(--text-secondary); }
        .product-footer { display: flex; justify-content: space-between; align-items: center; }
        .product-price { font-size: 13px; font-weight: 500; }
        .sold-out { font-size: 12px; color: var(--red); }
        .btn-add {
          padding: 5px 12px; font-size: 12px; border: 1px solid var(--border-strong);
          border-radius: 6px; background: var(--surface-1); color: var(--text-primary);
        }

        .empty-note { font-size: 13px; color: var(--text-secondary); padding: 8px 0; }

        .cart-panel {
          display: block; background: var(--surface-1); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px; margin-top: 20px; scroll-margin-top: 20px;
        }
        @media (min-width: 860px) {
          .cart-panel { margin-top: 0; position: sticky; top: 20px; }
        }
        .section-title { font-size: 16px; margin-bottom: 10px; }

        .cart-list { border: 1px solid var(--border); border-radius: var(--radius); padding: 4px 14px; margin-bottom: 14px; }
        .cart-row { padding: 9px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
        .cart-row:last-child { border-bottom: none; }
        .cart-row-main { display: flex; justify-content: space-between; }
        .cart-row-note { margin: 3px 0 0; font-size: 11px; color: var(--text-secondary); }

        .field-input {
          width: 100%; padding: 8px 10px; font-size: 13px; border: 1px solid var(--border);
          border-radius: 8px; margin-bottom: 10px; box-sizing: border-box; font-family: var(--font-body);
        }
        .field-label { font-size: 11px; color: var(--text-secondary); }

        .cart-total-row { display: flex; justify-content: space-between; margin: 12px 0; }
        .cart-total-label { font-size: 13px; color: var(--text-secondary); }
        .cart-total-value { font-size: 16px; font-weight: 500; }

        .checkout-error { font-size: 12px; color: var(--red); margin-bottom: 10px; }

        .btn-checkout {
          width: 100%; padding: 10px; font-size: 13px; border: none; border-radius: 8px;
          background: var(--green); color: var(--cream); font-weight: 500; box-sizing: border-box;
        }
        .btn-checkout:disabled { background: var(--surface-2); color: var(--text-muted); }
        .btn-secondary {
          width: 100%; padding: 9px; font-size: 13px; background: var(--surface-2);
          border: 1px solid var(--border-strong); border-radius: 8px;
        }

        .login-prompt { font-size: 12px; color: var(--text-secondary); }
        .login-prompt a { color: var(--green); }

        .placed-order-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
        .placed-order-title { margin: 0 0 6px; font-size: 13px; font-weight: 500; }
        .placed-order-meta { margin: 0 0 12px; font-size: 12px; color: var(--text-secondary); }

        .custom-cake-form { border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px; background: var(--surface-1); }
        .custom-cake-title { margin: 0 0 4px; font-size: 13px; font-weight: 500; }
        .custom-cake-rate { margin: 0 0 14px; font-size: 12px; color: var(--text-secondary); }
        .custom-cake-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
        .custom-cake-price { font-size: 13px; font-weight: 500; }
        .btn-add-cake { padding: 8px 16px; font-size: 13px; background: var(--green); color: var(--cream); border: none; border-radius: 8px; }

        .mobile-cart-bar {
          position: fixed; bottom: calc(var(--tabbar-h) + 12px); left: 16px; right: 16px;
          background: var(--green); color: var(--cream); border: none;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 12px 16px; border-radius: var(--radius); z-index: 19;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        }
        .mobile-cart-count { font-size: 12px; opacity: 0.85; }
        .mobile-cart-total { font-size: 14px; font-weight: 600; }
        .mobile-cart-cta { font-size: 12px; text-decoration: underline; }
        @media (min-width: 860px) {
          .mobile-cart-bar { display: none; }
        }
      `}</style>
    </div>
  );
}
