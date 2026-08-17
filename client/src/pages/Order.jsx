import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";

// Known categories get a curated label/icon; anything else (including a
// brand-new category the owner just created in Menu admin) still shows up
// as a tab automatically, just with a generic icon and its raw name as the
// label — see the `categories` useMemo below, which derives the actual tab
// list from real menu data instead of this fixed set.
const CATEGORY_META = {
  breads: { label: "Breads", icon: "🍞", tone: "ph-bread" },
  cookies: { label: "Cookies", icon: "🍪", tone: "ph-cookie" },
  pastries: { label: "Pastries", icon: "🥐", tone: "ph-cookie" },
  cakes: { label: "Cakes", icon: "🎂", tone: "ph-cake" },
  custom: { label: "Custom order", icon: "✏️", tone: "ph-custom" }
};
const FALLBACK_CATEGORY_META = { icon: "🧁", tone: "ph-fallback" };
const BASE_CATEGORY_ORDER = ["breads", "cookies", "pastries", "cakes", "custom"];

const paymentOptions = [
  { id: "cash", label: "Cash on pickup" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" }
];

const FAVORITES_KEY = "garners_favorites";
// Browser-local only — no account, no server round-trip. A real per-customer
// favorites list would need a backend table + endpoints; this is the
// frontend-only version of that idea, explicitly scoped that way for now.
const loadFavorites = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const ACTIVE_STATUSES = ["placed", "baking", "ready"];

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

const AUTO_ROTATE_MS = 3200;
// Auto-play is opt-out for anyone who's told their OS motion makes them
// uncomfortable — checked once per card, not re-evaluated live, which matches
// how every other prefers-reduced-motion check in this app already behaves.
const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function ProductCard({ item, isFav, onToggleFav, onAdd }) {
  // Cover photo first, then any extra gallery photos — one unified, swipeable set.
  const photos = item.imageUrl ? [item.imageUrl, ...item.galleryImages] : item.galleryImages;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const hasGallery = photos.length > 1;
  const stepPhoto = (dir) => setPhotoIndex((i) => (i + dir + photos.length) % photos.length);

  // A manual tap counts as "I'm interacting with this" — pause auto-rotate for a
  // few seconds afterward so it doesn't immediately override what was just chosen.
  const manualStep = (dir) => {
    stepPhoto(dir);
    setPaused(true);
    setTimeout(() => setPaused(false), AUTO_ROTATE_MS * 2);
  };

  useEffect(() => {
    if (!hasGallery || paused || prefersReducedMotion) return;
    const id = setInterval(() => stepPhoto(1), AUTO_ROTATE_MS);
    return () => clearInterval(id);
  }, [hasGallery, paused, photos.length]);

  return (
    <div
      className={`product-card${!item.inStock ? " product-card-out" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="product-photo-wrap">
        {photos.length > 0 ? (
          <img src={photos[photoIndex]} alt={item.name} className="product-photo" />
        ) : (
          <div className="product-photo product-photo-empty">🍞</div>
        )}
        {item.isPopular && <span className="badge-pop">🔥 Popular</span>}
        <button
          className={`fav-btn${isFav ? " on" : ""}`}
          onClick={() => onToggleFav(item.id)}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={isFav}
        >
          ♥
        </button>
        {hasGallery && (
          <>
            <button className="gallery-nav left" onClick={() => manualStep(-1)} aria-label="Previous photo" />
            <button className="gallery-nav right" onClick={() => manualStep(1)} aria-label="Next photo" />
            <div className="gallery-dots">
              {photos.map((_, i) => <span key={i} className={i === photoIndex ? "on" : ""} />)}
            </div>
          </>
        )}
      </div>
      <div className="product-body">
        <p className="product-name">{item.name}</p>
        <p className="product-desc">{item.description}</p>
        <div className="product-footer">
          <span className="product-price">{item.price ? `₹${item.price}` : "made to order"}</span>
          {!item.inStock ? (
            <span className="sold-out">Sold out</span>
          ) : (
            item.price && (
              <button onClick={() => onAdd(item)} className="btn-add">Add</button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function Order() {
  const [menu, setMenu] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [pickupTime, setPickupTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [favorites, setFavorites] = useState(loadFavorites);
  const { user } = useAuth();
  const { cart, addToCart, addCustomItem, clearCart, total, count: cartCount } = useCart();
  const canOrder = user && user.role === "customer";
  const cartRef = useRef(null);

  useEffect(() => {
    api.getMenu().then((d) => setMenu(d.items)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!canOrder) {
      setActiveOrder(null);
      return;
    }
    api
      .getMyOrders()
      .then((d) => setActiveOrder(d.orders.find((o) => ACTIVE_STATUSES.includes(o.status)) || null))
      .catch(() => {}); // the tracker is a nice-to-have — a failed fetch shouldn't block browsing
  }, [canOrder]);

  // Real, current categories only — "special" never becomes a browsable tab
  // (those items only ever show in the Today's Specials strip above), and a
  // category with zero items in it right now just doesn't appear yet.
  const categories = useMemo(() => {
    if (!menu) return [];
    const present = new Set(menu.map((m) => m.category));
    present.delete("special");
    const ordered = BASE_CATEGORY_ORDER.filter((c) => present.has(c));
    present.forEach((c) => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered.map((id) => {
      const meta = CATEGORY_META[id] || FALLBACK_CATEGORY_META;
      return { id, label: meta.label || id.charAt(0).toUpperCase() + id.slice(1), icon: meta.icon, tone: meta.tone };
    });
  }, [menu]);

  useEffect(() => {
    if (activeCategory === null && categories.length > 0) setActiveCategory(categories[0].id);
  }, [categories, activeCategory]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const addCustomCake = (customItemId) => ({ size, flavor, message, neededBy, price }) => {
    const note = [message, neededBy ? `Needed by ${neededBy}` : null].filter(Boolean).join(" — ");
    addCustomItem({
      id: `custom-${Date.now()}`,
      menuItemId: customItemId,
      name: `Custom cake — ${flavor}, ${size}kg`,
      price,
      qty: 1,
      note
    });
  };

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
      setActiveOrder(order.order);
      clearCart();
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

  const q = search.trim().toLowerCase();
  const searchable = menu.filter((m) => m.category !== "custom" && m.category !== "special");
  const shown = q ? searchable.filter((m) => m.name.toLowerCase().includes(q)) : menu.filter((m) => m.category === activeCategory);
  const customCakeItem = menu.find((m) => m.category === "custom");
  const specials = menu.filter((m) => m.isSpecial);

  const selectCategory = (id) => {
    setSearch("");
    setActiveCategory(id);
  };

  return (
    <div className="page order-page">
      <div className="hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">✨ Baked daily</span>
          <h1 className="hero-title">Oven-fresh, baked daily</h1>
          <p className="hero-sub">Store pick up · oven fresh daily bakes</p>
        </div>
      </div>

      {activeOrder && (
        <Link to={`/receipt/${activeOrder.id}`} className="tracker">
          <span className="tracker-dot" />
          <span className="tracker-body">
            <span className="tracker-title">Order #{activeOrder.id} · {activeOrder.status}</span>
            <span className="tracker-meta">
              {activeOrder.items.length} item{activeOrder.items.length === 1 ? "" : "s"} · pickup {activeOrder.pickupTime}
            </span>
          </span>
          <span className="tracker-chevron">›</span>
        </Link>
      )}

      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input
          className="search-input"
          type="text"
          placeholder="Search the menu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {specials.length > 0 && !q && (
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
            onClick={() => selectCategory(c.id)}
            className={`chip${!q && activeCategory === c.id ? " chip-active" : ""}`}
          >
            <span className={`chip-thumb ${c.tone}`}>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      <div className="order-layout">
        {!q && activeCategory === "custom" ? (
          customCakeItem ? (
            <CustomCakeForm pricePerKg={customCakeItem.price} onAdd={addCustomCake(customCakeItem.id)} />
          ) : (
            <p className="empty-note">Custom cakes aren't available right now.</p>
          )
        ) : (
          <div className="product-grid">
            {shown.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                isFav={favorites.has(item.id)}
                onToggleFav={toggleFavorite}
                onAdd={addToCart}
              />
            ))}
            {shown.length === 0 && (
              <p className="empty-note">{q ? `Nothing matches "${search}".` : "Nothing in this category yet."}</p>
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
        .hero {
          margin-bottom: 16px; border-radius: var(--radius-lg); overflow: hidden; position: relative;
          min-height: 132px; display: flex; align-items: center;
          background:
            radial-gradient(120% 140% at 15% 20%, rgba(184,146,90,0.55), transparent 55%),
            linear-gradient(120deg, #7a4a26, #3f2a17 60%, #241811);
        }
        .hero-copy { position: relative; z-index: 1; padding: 22px 22px; color: var(--cream); }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 5px; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.07em; background: rgba(250,248,243,0.16); border: 1px solid rgba(250,248,243,0.3);
          padding: 3px 10px; border-radius: 999px; margin-bottom: 10px;
        }
        .hero-title { font-size: 26px; margin: 0 0 5px; line-height: 1.15; color: var(--cream); }
        .hero-sub { font-size: 12.5px; opacity: 0.85; margin: 0; }

        .tracker {
          display: flex; align-items: center; gap: 11px; margin-bottom: 16px;
          background: var(--surface-1); border: 1px solid var(--gold); border-radius: var(--radius);
          padding: 12px 14px; text-decoration: none; color: var(--text-primary);
        }
        .tracker-dot {
          width: 9px; height: 9px; border-radius: 50%; background: var(--warning-text);
          flex-shrink: 0; box-shadow: 0 0 0 4px var(--warning-bg);
        }
        .tracker-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .tracker-title { font-size: 13px; font-weight: 600; }
        .tracker-meta { font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; }
        .tracker-chevron { font-size: 17px; color: var(--text-muted); flex-shrink: 0; }

        .search-wrap { position: relative; margin-bottom: 20px; }
        .search-input {
          width: 100%; box-sizing: border-box; padding: 10px 14px 10px 38px;
          border-radius: 10px; border: 1px solid var(--border); background: var(--surface-1);
          font-size: 13.5px; font-family: var(--font-body); color: var(--text-primary);
        }
        .search-input::placeholder { color: var(--text-muted); }
        .search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); font-size: 13px; opacity: 0.6; }

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
          display: flex; gap: 16px; overflow-x: auto; padding: 2px 2px 6px;
          margin-bottom: 20px; -webkit-overflow-scrolling: touch;
        }
        .category-scroll::-webkit-scrollbar { display: none; }
        .chip {
          flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;
          border: none; background: none; width: 64px; font-size: 11.5px; color: var(--text-secondary);
          white-space: nowrap; font-weight: 500;
        }
        .chip-thumb {
          width: 56px; height: 56px; border-radius: 50%; border: 2px solid transparent;
          display: flex; align-items: center; justify-content: center; font-size: 24px;
          transition: border-color .12s ease, transform .12s ease;
        }
        .chip-active { color: var(--charcoal); font-weight: 700; }
        .chip-active .chip-thumb { border-color: var(--gold); transform: scale(1.05); }
        .chip:active .chip-thumb { transform: scale(0.94); }
        .ph-bread { background: linear-gradient(135deg,#e6c68f,#c99a5c); }
        .ph-cookie { background: linear-gradient(135deg,#c9955f,#8f5a2e); }
        .ph-cake { background: linear-gradient(135deg,#d9c08f,#a97a3d); }
        .ph-custom { background: linear-gradient(135deg,#e0c5e0,#b88fc9); }
        .ph-fallback { background: linear-gradient(135deg,#c9b896,#a08a5f); }

        .order-layout { display: block; }
        @media (min-width: 860px) {
          .order-layout { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: start; }
        }

        .product-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (min-width: 520px) { .product-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 860px) { .product-grid { grid-template-columns: 1fr 1fr; } }

        .product-card {
          background: var(--surface-1); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
          transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease;
        }
        .product-card:hover, .product-card:focus-within {
          transform: translateY(-2px); box-shadow: 0 10px 20px -12px rgba(0,0,0,0.25); border-color: var(--border-strong);
        }
        .product-card-out { opacity: 0.6; }
        .product-photo-wrap { position: relative; }
        .product-photo { width: 100%; height: 112px; object-fit: cover; }
        .product-photo-empty {
          background: var(--surface-2); display: flex; align-items: center; justify-content: center; font-size: 26px;
        }
        .fav-btn {
          position: absolute; right: 7px; top: 7px; width: 26px; height: 26px; border-radius: 50%;
          background: rgba(255,255,255,0.85); border: none; display: flex; align-items: center; justify-content: center;
          font-size: 13px; color: var(--text-muted); transition: transform .12s ease, color .12s ease;
          z-index: 3;
        }
        .fav-btn.on { color: var(--red); }
        .fav-btn:active { transform: scale(0.85); }
        .badge-pop {
          position: absolute; left: 7px; top: 7px; z-index: 2; pointer-events: none;
          background: rgba(38,36,31,0.82); color: #fff; font-size: 10px; font-weight: 700;
          padding: 3px 8px; border-radius: 999px;
        }
        .gallery-nav {
          position: absolute; top: 24px; bottom: 0; width: 34%; background: none; border: none; padding: 0; z-index: 1;
        }
        .gallery-nav.left { left: 0; } .gallery-nav.right { right: 0; }
        .gallery-dots {
          position: absolute; left: 0; right: 0; bottom: 6px; display: flex; justify-content: center; gap: 4px;
          z-index: 2; pointer-events: none;
        }
        .gallery-dots span { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.55); }
        .gallery-dots span.on { background: #fff; width: 11px; border-radius: 3px; }
        .product-body { padding: 9px 11px 11px; }
        .product-name { margin: 0; font-size: 13px; font-weight: 500; }
        .product-desc { margin: 3px 0 10px; font-size: 12px; color: var(--text-secondary); }
        .product-footer { display: flex; justify-content: space-between; align-items: center; }
        .product-price { font-size: 13px; font-weight: 500; }
        .sold-out { font-size: 12px; color: var(--red); }
        .btn-add {
          padding: 5px 12px; font-size: 12px; font-weight: 600; border: 1px solid var(--green);
          color: var(--green); border-radius: 999px; background: var(--surface-1);
          transition: background .12s ease, color .12s ease, transform .1s ease;
        }
        .btn-add:hover { background: var(--green); color: var(--cream); }
        .btn-add:active { transform: scale(0.94); }

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
