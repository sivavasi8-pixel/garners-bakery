import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { paymentLabel } from "../paymentLabel";
import { ZONES, calculateFee } from "../deliveryZones";

// Known categories get a curated label; anything else (including a brand-new
// category the owner just created in Menu admin) still shows up as a tab
// automatically with its raw name — see the `categories` useMemo below, which
// derives the actual tab list from real menu data instead of this fixed set.
const CATEGORY_LABELS = {
  breads: "Breads",
  cookies: "Cookies",
  pastries: "Pastries",
  cakes: "Cakes",
  custom: "Custom cake"
};
const BASE_CATEGORY_ORDER = ["breads", "cookies", "pastries", "cakes", "custom"];

const paymentOptions = (fulfillment) => [
  {
    id: "cash",
    label: fulfillment === "delivery" ? "Cash on delivery" : "Cash at pickup",
    note: fulfillment === "delivery" ? "Pay when it arrives" : "Pay at the counter"
  },
  { id: "upi", label: "UPI", note: "We confirm your payment before it shows as paid" },
  {
    id: "card",
    label: fulfillment === "delivery" ? "Card on delivery" : "Card at pickup",
    note: fulfillment === "delivery" ? "Card machine at the door" : "Card machine at the counter"
  }
];

const FAVORITES_KEY = "garners_favorites";
// Same loose rule as signup (server/controllers/authController.js) — Indian mobiles
// with or without +91, landlines, spaces and dashes are all fine.
const PHONE_RE = /^[+\d][\d\s-]{6,19}$/;
// Browser-local conveniences only — no account, no server round-trip.
const loadFavorites = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const ACTIVE_STATUSES = ["placed", "baking", "ready"];
const STATUS_WORDS = { placed: "Order received", baking: "In the oven", ready: "Ready" };

// Custom cakes need a day's notice (server/data/slots.js CUSTOM_CAKE_LEAD_DAYS);
// the checkout greys out "Today" when the bag holds one.
const isCustomLine = (c) => c.size !== undefined;

function Icon({ name, size = 18 }) {
  return <i className={`ti ti-${name}`} style={{ fontSize: size }} aria-hidden="true" />;
}

function Stepper({ qty, onMinus, onPlus, label }) {
  return (
    <div className="stepper" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" onClick={onMinus} aria-label={`Remove one ${label}`}>−</button>
      <span aria-live="polite">{qty}</span>
      <button type="button" onClick={onPlus} aria-label={`Add one ${label}`}>+</button>
    </div>
  );
}

function CustomCakeForm({ pricePerKg, onAdd }) {
  const [size, setSize] = useState("1");
  const [flavor, setFlavor] = useState("");
  const [message, setMessage] = useState("");

  const price = Math.round((pricePerKg || 0) * (Number(size) || 0));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!flavor || !size) return;
    onAdd({ size: Number(size), flavor, message, price });
    setSize("1");
    setFlavor("");
    setMessage("");
  };

  return (
    <form onSubmit={handleSubmit} className="custom-cake-form">
      <span className="eyebrow">Made to order</span>
      <h2 className="custom-cake-title">Design your cake</h2>
      <p className="custom-cake-rate">₹{pricePerKg}/kg, decorated and baked to order. Pick the day at checkout — custom cakes need a day's notice.</p>

      <div className="custom-cake-fields">
        <label className="field">
          <span className="field-label">Size (kg)</span>
          <input id="cake-size" type="number" min="0.5" max="20" step="0.5" value={size} onChange={(e) => setSize(e.target.value)} className="field-input" required />
        </label>
        <label className="field">
          <span className="field-label">Flavour</span>
          <input
            id="cake-flavor"
            type="text"
            placeholder="e.g. Chocolate truffle, Red velvet"
            value={flavor}
            onChange={(e) => setFlavor(e.target.value)}
            className="field-input"
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Message on the cake (optional)</span>
          <input
            id="cake-message"
            type="text"
            placeholder="e.g. Happy Birthday Aanya!"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="field-input"
          />
        </label>
      </div>

      <div className="custom-cake-footer">
        <span className="custom-cake-price">₹{(price || 0).toLocaleString("en-IN")}</span>
        <button type="submit" className="btn-primary">Add to bag</button>
      </div>
    </form>
  );
}

const AUTO_ROTATE_MS = 3200;
// Auto-play is opt-out for anyone who's told their OS motion makes them
// uncomfortable — checked once per card, not re-evaluated live.
const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function ProductCard({ item, isFav, onToggleFav, inBag, onAdd, onMinus }) {
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
    <article
      className={`product-card${!item.inStock ? " product-card-out" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="product-photo-wrap">
        {photos.length > 0 ? (
          <img src={photos[photoIndex]} alt={item.name} className="product-photo" loading="lazy" />
        ) : (
          <div className="product-photo product-photo-empty"><Icon name="bread" size={26} /></div>
        )}
        {item.isPopular && <span className="badge-pop">Popular</span>}
        <button
          type="button"
          className={`fav-btn${isFav ? " on" : ""}`}
          onClick={() => onToggleFav(item.id)}
          aria-label={isFav ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`}
          aria-pressed={isFav}
        >
          <Icon name={isFav ? "heart-filled" : "heart"} size={16} />
        </button>
        {hasGallery && (
          <>
            <button type="button" className="gallery-nav left" onClick={() => manualStep(-1)} aria-label="Previous photo" />
            <button type="button" className="gallery-nav right" onClick={() => manualStep(1)} aria-label="Next photo" />
            <div className="gallery-dots">
              {photos.map((_, i) => <span key={i} className={i === photoIndex ? "on" : ""} />)}
            </div>
          </>
        )}
      </div>
      <div className="product-body">
        <h3 className="product-name">{item.name}</h3>
        {item.description && <p className="product-desc">{item.description}</p>}
        <div className="product-footer">
          <span className="product-price">
            {item.price ? `₹${item.price}` : "Made to order"}
            {item.price && item.unit ? <span className="product-unit"> / {item.unit}</span> : null}
          </span>
          {!item.inStock ? (
            <span className="sold-out">Sold out</span>
          ) : !item.price ? null : inBag ? (
            <Stepper qty={inBag.qty} label={item.name} onMinus={onMinus} onPlus={() => onAdd(item)} />
          ) : (
            <button type="button" onClick={() => onAdd(item)} className="btn-add" aria-label={`Add ${item.name} to bag`}>
              <Icon name="plus" size={18} />
              <span className="btn-add-text">Add</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Order() {
  const [menu, setMenu] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [storeStatus, setStoreStatus] = useState(null);
  const [fulfillment, setFulfillment] = useState("pickup");
  const [deliveryZone, setDeliveryZone] = useState(ZONES[0].id);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupDate, setPickupDate] = useState(null);
  const [pickupSlot, setPickupSlot] = useState(null);
  const { user } = useAuth();
  const { cart, addToCart, addCustomItem, changeQty, clearCart, total, count: cartCount } = useCart();
  const canOrder = user && user.role === "customer";
  const cartRef = useRef(null);
  const menuRef = useRef(null);
  const location = useLocation();

  // Prefill from the account's saved number (asked at signup) once it's known —
  // still editable; accounts created before that field existed just start blank.
  useEffect(() => {
    if (user?.phone) setPhone((p) => p || user.phone);
  }, [user]);

  useEffect(() => {
    api.getMenu().then((d) => setMenu(d.items)).catch((e) => setError(e.message));
    api.getStoreStatus().then(setStoreStatus).catch(() => {}); // banner + slots are nice-to-haves for browsing
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

  // The bag button in the header links to "/order#bag".
  useEffect(() => {
    if (location.hash === "#bag" && menu) {
      cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, menu]);

  // Real, current categories only — "special" never becomes a browsable tab
  // (those items only ever show in the Today's special strip), and a category
  // with zero items in it right now just doesn't appear yet.
  const categories = useMemo(() => {
    if (!menu) return [];
    const present = new Set(menu.map((m) => m.category));
    present.delete("special");
    const ordered = BASE_CATEGORY_ORDER.filter((c) => present.has(c));
    present.forEach((c) => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered.map((id) => ({ id, label: CATEGORY_LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1) }));
  }, [menu]);

  useEffect(() => {
    if (activeCategory === null && categories.length > 0) setActiveCategory(categories[0].id);
  }, [categories, activeCategory]);

  // Days a customer can book: closed Mondays stay visible but disabled, and a bag
  // with a custom cake can't book today.
  const hasCustomCake = cart.some(isCustomLine);
  const days = useMemo(
    () =>
      (storeStatus?.days || []).map((d, i) => ({
        ...d,
        disabled: d.closed || d.slots.length === 0 || (hasCustomCake && i === 0)
      })),
    [storeStatus, hasCustomCake]
  );
  // Keep the chosen day/slot valid as the bag or the clock changes.
  useEffect(() => {
    const current = days.find((d) => d.date === pickupDate);
    if (!current || current.disabled) {
      const first = days.find((d) => !d.disabled);
      setPickupDate(first ? first.date : null);
      setPickupSlot(null);
    } else if (pickupSlot && !current.slots.some((s) => s.value === pickupSlot)) {
      setPickupSlot(null);
    }
  }, [days, pickupDate, pickupSlot]);
  const selectedDay = days.find((d) => d.date === pickupDate);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // storage blocked — favourites last for this visit only
      }
      return next;
    });
  };

  const addCustomCake = (customItemId) => ({ size, flavor, message, price }) => {
    addCustomItem({
      id: `custom-${Date.now()}`,
      menuItemId: customItemId,
      name: `Custom cake — ${flavor}, ${size}kg`,
      size, // the server prices per-kg items from the menu rate × size
      price,
      qty: 1,
      note: message || undefined
    });
    cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectedZone = ZONES.find((z) => z.id === deliveryZone);
  const { fee: deliveryFee, pending: deliveryFeePending } =
    fulfillment === "delivery" ? calculateFee(deliveryZone, total) : { fee: 0, pending: false };
  const belowMinOrder = fulfillment === "delivery" && selectedZone && total < selectedZone.minOrder;
  const grandTotal = total + (deliveryFee || 0);
  const isClosedToday = storeStatus?.closedToday;
  const phoneOk = PHONE_RE.test(phone.trim());
  // Required for delivery (staff may need to call, e.g. to confirm a Porter fee);
  // optional for pickup — but if one is typed, it has to look like a number.
  const phoneProblem = fulfillment === "delivery" ? !phoneOk : phone.trim() !== "" && !phoneOk;

  const missing = [
    fulfillment === "delivery" && !deliveryAddress.trim() && "your address",
    phoneProblem && (fulfillment === "delivery" ? "a phone number for delivery" : "a valid phone number"),
    !pickupSlot && "a time"
  ].filter(Boolean);

  const handleCheckout = async () => {
    setCheckoutError(null);
    setPlacing(true);
    try {
      const order = await api.createOrder({
        // Prices and totals are calculated by the server from the menu; only what the
        // customer chose (item, quantity, cake size, note) is sent.
        items: cart.map((c) => ({ menuItemId: c.menuItemId, name: c.name, qty: c.qty, size: c.size, note: c.note })),
        pickupDate,
        pickupSlot,
        customerPhone: phone.trim() || undefined,
        channel: "online",
        paymentMethod,
        deliveryType: fulfillment,
        deliveryZone: fulfillment === "delivery" ? deliveryZone : undefined,
        deliveryAddress: fulfillment === "delivery" ? deliveryAddress : undefined
      });
      setPlacedOrder(order.order);
      setActiveOrder(order.order);
      clearCart();
      setPickupSlot(null);
      setDeliveryAddress("");
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  const scrollToCart = () => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToMenu = () => menuRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (error) return <p className="page" style={{ color: "var(--red)" }}>Couldn't load the menu: {error}. Please refresh to try again.</p>;
  if (!menu) return <p className="page" style={{ color: "var(--text-secondary)" }}>Loading the menu…</p>;

  const q = search.trim().toLowerCase();
  const searchable = menu.filter((m) => m.category !== "custom" && m.category !== "special");
  const shown = q ? searchable.filter((m) => m.name.toLowerCase().includes(q)) : menu.filter((m) => m.category === activeCategory);
  const customCakeItem = menu.find((m) => m.category === "custom");
  const specials = menu.filter((m) => m.isSpecial);
  const bagLine = (id) => cart.find((c) => c.id === id);

  const selectCategory = (id) => {
    setSearch("");
    setActiveCategory(id);
  };
  const openCustomCake = () => {
    selectCategory("custom");
    scrollToMenu();
  };

  return (
    <div className="order-page">
      <section className="hero">
        <div className="hero-inner">
          <span className="open-pill">
            <span className={`open-dot${isClosedToday ? " closed" : ""}`} />
            {isClosedToday ? "Closed today · back tomorrow" : "Open today · Closed Mondays"}
          </span>
          <h1 className="hero-title">Baked this morning in Whitefield.</h1>
          <p className="hero-sub">Breads, bakes and custom cakes. Collect at the counter or get it delivered.</p>
          <div className="hero-actions">
            <button type="button" className="hero-btn solid" onClick={scrollToMenu}>Order now</button>
            {customCakeItem && <button type="button" className="hero-btn ghost" onClick={openCustomCake}>Custom cake</button>}
          </div>
        </div>
      </section>

      <div className="page order-body">
        {isClosedToday && (
          <div className="notice warning" role="status">
            <Icon name="clock" />
            <span>We're closed today (Monday). Browse the menu now — online ordering reopens tomorrow.</span>
          </div>
        )}

        {activeOrder && (
          <Link to="/my-orders" className="tracker">
            <span className="tracker-dot" />
            <span className="tracker-body">
              <span className="tracker-title">Order #{activeOrder.id} · {STATUS_WORDS[activeOrder.status] || activeOrder.status}</span>
              <span className="tracker-meta">
                {activeOrder.items.length} item{activeOrder.items.length === 1 ? "" : "s"} · {activeOrder.deliveryType === "delivery" ? "delivery" : "pickup"} {activeOrder.pickupTime}
              </span>
            </span>
            <Icon name="chevron-right" />
          </Link>
        )}

        <label className="search-wrap">
          <Icon name="search" />
          <input
            id="menu-search"
            className="search-input"
            type="search"
            placeholder="Search breads, cakes, cookies"
            aria-label="Search the menu"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        {specials.length > 0 && !q && (
          <section className="specials-section" aria-labelledby="specials-heading">
            <div className="section-head">
              <h2 id="specials-heading">Today's special</h2>
              <span>Until close</span>
            </div>
            <div className="specials-grid">
              {specials.map((item) => (
                <article key={item.id} className="special-card">
                  <div className="special-photo-wrap">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="special-photo" />
                    ) : (
                      <div className="special-photo special-photo-empty"><Icon name="cake" size={28} /></div>
                    )}
                    <span className="special-ribbon">Today only</span>
                  </div>
                  <div className="special-body">
                    <div className="special-text">
                      <h3 className="special-name">{item.name}</h3>
                      {item.description && <p className="special-desc">{item.description}</p>}
                      <span className="special-price">{item.price ? `₹${item.price}` : "Made to order"}</span>
                    </div>
                    {!item.inStock ? (
                      <span className="sold-out">Sold out</span>
                    ) : item.price && bagLine(item.id) ? (
                      <Stepper qty={bagLine(item.id).qty} label={item.name} onMinus={() => changeQty(item.id, -1)} onPlus={() => addToCart(item)} />
                    ) : item.price ? (
                      <button type="button" onClick={() => addToCart(item)} className="btn-primary">Add</button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section ref={menuRef} className="menu-section" aria-labelledby="menu-heading">
          <h2 id="menu-heading" className="section-title-lg">Menu</h2>
          <div className="category-scroll" role="tablist" aria-label="Menu categories">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={!q && activeCategory === c.id}
                onClick={() => selectCategory(c.id)}
                className={`chip${!q && activeCategory === c.id ? " chip-active" : ""}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="order-layout">
            <div className="order-main">
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
                      inBag={bagLine(item.id)}
                      onAdd={addToCart}
                      onMinus={() => changeQty(item.id, -1)}
                    />
                  ))}
                  {shown.length === 0 && (
                    <p className="empty-note">{q ? `Nothing matches "${search}". Try another word.` : "Nothing in this category today."}</p>
                  )}
                </div>
              )}

              {customCakeItem && activeCategory !== "custom" && !q && (
                <section className="cake-promo" aria-labelledby="cake-promo-heading">
                  <span className="eyebrow light">Made to order</span>
                  <h2 id="cake-promo-heading">Custom cakes from ₹{Number(customCakeItem.price).toLocaleString("en-IN")}/kg</h2>
                  <p>Choose the size, flavour and message. Pick a day at checkout and we'll have it ready.</p>
                  <button type="button" className="hero-btn solid" onClick={openCustomCake}>Design your cake</button>
                </section>
              )}
            </div>

            <aside id="bag" className="cart-panel" ref={cartRef} aria-labelledby="bag-heading">
              <h2 id="bag-heading" className="cart-title">Your bag</h2>

              {placedOrder ? (
                <div className="placed-order-card" role="status">
                  <span className="placed-icon"><Icon name="check" size={22} /></span>
                  <p className="placed-order-title">Order #{placedOrder.id} placed</p>
                  <p className="placed-order-meta">
                    {placedOrder.deliveryType === "delivery" ? "Delivery" : "Pickup"} · {placedOrder.pickupTime}
                    <br />
                    Payment: {paymentLabel(placedOrder).toLowerCase()}
                  </p>
                  <Link to="/my-orders" className="btn-checkout">Track your order</Link>
                  <Link to={`/receipt/${placedOrder.id}`} className="btn-secondary">View receipt</Link>
                  <button type="button" onClick={() => setPlacedOrder(null)} className="btn-text">Place another order</button>
                </div>
              ) : (
                <>
                  {cart.length === 0 ? (
                    <p className="empty-note">Your bag is empty. Add something from the menu.</p>
                  ) : (
                    <div className="cart-list">
                      {cart.map((c) => (
                        <div key={c.id} className="cart-row">
                          <div className="cart-row-text">
                            <span className="cart-row-name">{c.name}</span>
                            <span className="cart-row-detail">{c.note ? `“${c.note}”` : `₹${c.price} each`}</span>
                          </div>
                          <Stepper qty={c.qty} label={c.name} onMinus={() => changeQty(c.id, -1)} onPlus={() => changeQty(c.id, 1)} />
                          <span className="cart-row-total">₹{(c.price * c.qty).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Login prompt — shown immediately after the item list when the user
                      isn't logged in. Keeps the checkout form hidden so they don't
                      waste time filling in address/time/payment before realising they
                      need an account. The bag persists across login (CartContext uses
                      localStorage), so "Your bag stays right here" is accurate. */}
                  {!canOrder && cart.length > 0 && (
                    <div className="login-gate">
                      <i className="ti ti-lock" aria-hidden="true" style={{ fontSize: 28, color: "var(--green)", marginBottom: 8 }} />
                      <p className="login-gate-title">Log in to place your order</p>
                      <p className="login-gate-sub">Your bag stays right here while you sign in.</p>
                      <Link to="/login" state={{ from: "/order" }} className="btn-checkout">
                        Log in
                      </Link>
                      <Link to="/signup" className="btn-secondary">
                        Create an account
                      </Link>
                    </div>
                  )}

                  {canOrder && cart.length > 0 && (
                    <>
                      <fieldset className="checkout-step">
                        <legend>How do you want it?</legend>
                        <div className="segmented">
                          {[
                            { id: "pickup", label: "Pickup", note: "From the shop" },
                            { id: "delivery", label: "Delivery", note: "To your door" }
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              aria-pressed={fulfillment === f.id}
                              className={`segment${fulfillment === f.id ? " on" : ""}`}
                              onClick={() => setFulfillment(f.id)}
                            >
                              <span>{f.label}</span>
                              <small>{f.note}</small>
                            </button>
                          ))}
                        </div>

                        {fulfillment === "delivery" && (
                          <>
                            <div className="option-list">
                              {ZONES.map((z) => {
                                const { fee, pending } = calculateFee(z.id, total);
                                const note =
                                  z.feeType === "free" ? "No minimum" :
                                  z.feeType === "tiered" ? `Free over ₹${z.freeAboveThreshold} · min ₹${z.minOrder}` :
                                  `Porter rate · we call to confirm · min ₹${z.minOrder}`;
                                return (
                                  <label key={z.id} className={`option${deliveryZone === z.id ? " on" : ""}`}>
                                    <input
                                      type="radio"
                                      name="zone"
                                      value={z.id}
                                      checked={deliveryZone === z.id}
                                      onChange={() => setDeliveryZone(z.id)}
                                    />
                                    <span className="option-text">
                                      <span>{z.label}</span>
                                      <small>{note}</small>
                                    </span>
                                    <span className="option-fee">{pending ? "TBC" : fee ? `₹${fee}` : "Free"}</span>
                                  </label>
                                );
                              })}
                            </div>
                            {belowMinOrder && (
                              <p className="checkout-error">This area needs a minimum order of ₹{selectedZone.minOrder}. Add ₹{selectedZone.minOrder - total} more to deliver.</p>
                            )}
                            {deliveryFeePending && (
                              <p className="delivery-note">This is beyond our standard area — we'll call to confirm the Porter charge before baking starts.</p>
                            )}
                            <label className="field">
                              <span className="field-label">Delivery address</span>
                              <textarea
                                id="delivery-address"
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                className="field-input field-textarea"
                                rows={2}
                                autoComplete="street-address"
                                placeholder="House / flat, street, landmark"
                              />
                            </label>
                          </>
                        )}

                        <label className="field">
                          <span className="field-label">
                            Mobile number <span className="field-hint">· {fulfillment === "delivery" ? "needed for delivery" : "optional, so we can reach you"}</span>
                          </span>
                          <span className="phone-input">
                            <i className="ti ti-phone" aria-hidden="true" style={{ color: "var(--text-secondary)", fontSize: 18 }} />
                            <input
                              id="customer-phone"
                              type="tel"
                              autoComplete="tel"
                              placeholder="98450 12345"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                            />
                          </span>
                        </label>
                      </fieldset>

                      <fieldset className="checkout-step">
                        <legend>When?</legend>
                        {days.length === 0 ? (
                          <p className="empty-note">Loading times…</p>
                        ) : (
                          <>
                            <div className="day-chips">
                              {days.map((d) => (
                                <button
                                  key={d.date}
                                  type="button"
                                  disabled={d.disabled}
                                  aria-pressed={pickupDate === d.date}
                                  className={`day-chip${pickupDate === d.date ? " on" : ""}`}
                                  onClick={() => { setPickupDate(d.date); setPickupSlot(null); }}
                                >
                                  {d.label}{d.closed ? " · closed" : ""}
                                </button>
                              ))}
                            </div>
                            {hasCustomCake && <p className="delivery-note">Custom cakes need a day's notice, so today isn't available.</p>}
                            <div className="slot-grid">
                              {(selectedDay?.slots || []).map((s) => (
                                <button
                                  key={s.value}
                                  type="button"
                                  aria-pressed={pickupSlot === s.value}
                                  className={`slot${pickupSlot === s.value ? " on" : ""}`}
                                  onClick={() => setPickupSlot(s.value)}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </fieldset>

                      <fieldset className="checkout-step">
                        <legend>Payment</legend>
                        <div className="option-list">
                          {paymentOptions(fulfillment).map((p) => (
                            <label key={p.id} className={`option${paymentMethod === p.id ? " on" : ""}`}>
                              <input
                                type="radio"
                                name="payment"
                                value={p.id}
                                checked={paymentMethod === p.id}
                                onChange={() => setPaymentMethod(p.id)}
                              />
                              <span className="option-text">
                                <span>{p.label}</span>
                                <small>{p.note}</small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <div className="summary">
                        <div><span>Items</span><span>₹{total.toLocaleString("en-IN")}</span></div>
                        {fulfillment === "delivery" && (
                          <div><span>Delivery</span><span>{deliveryFeePending ? "To be confirmed" : deliveryFee ? `₹${deliveryFee}` : "Free"}</span></div>
                        )}
                        <div className="summary-total">
                          <span>Total</span>
                          <span>₹{grandTotal.toLocaleString("en-IN")}{deliveryFeePending ? " + delivery" : ""}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}

                  {canOrder && cart.length > 0 && (
                    <>
                      {missing.length > 0 && !isClosedToday && (
                        <p className="missing-note">To place your order, add {missing.join(", ")}.</p>
                      )}
                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={placing || isClosedToday || belowMinOrder || missing.length > 0}
                        className="btn-checkout"
                      >
                        {placing ? "Placing order…" : isClosedToday ? "Ordering reopens tomorrow" : `Place order · ₹${grandTotal.toLocaleString("en-IN")}`}
                      </button>
                    </>
                  )}
                </>
              )}
            </aside>
          </div>
        </section>
      </div>

      {/* Mobile bag bar — tapping it scrolls down to the bag, so checkout stays usable
          on phones without a separate drawer. */}
      {cartCount > 0 && !placedOrder && (
        <button type="button" className="mobile-cart-bar" onClick={scrollToCart}>
          <span>{cartCount} item{cartCount > 1 ? "s" : ""} · ₹{total.toLocaleString("en-IN")}</span>
          <span className="mobile-cart-cta">View bag <Icon name="arrow-right" size={16} /></span>
        </button>
      )}

      <style>{`
        .order-page { padding-bottom: calc(var(--tabbar-h) + 84px); }
        @media (min-width: 720px) { .order-page { padding-bottom: 48px; } }

        /* Hero — the green continues from the header into the welcome. */
        .hero { background: var(--green); color: var(--cream); }
        .hero-inner {
          max-width: 1280px; margin: 0 auto; padding: 8px 20px 30px;
          display: flex; flex-direction: column; gap: 14px;
        }
        @media (min-width: 960px) { .hero-inner { padding: 28px 32px 52px; } }
        .open-pill {
          align-self: flex-start; display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px; font-weight: 600; background: rgba(250,248,243,0.12); border-radius: 999px; padding: 6px 12px;
        }
        .open-dot { width: 8px; height: 8px; border-radius: 4px; background: #9ed3a6; }
        .open-dot.closed { background: #e8b0a6; }
        .hero-title { font-size: clamp(34px, 7vw, 60px); line-height: 1.04; letter-spacing: -0.01em; max-width: 14ch; }
        .hero-sub { margin: 0; font-size: clamp(15px, 2.2vw, 18px); line-height: 1.5; color: var(--on-green-muted); max-width: 46ch; }
        .hero-actions { display: flex; gap: 10px; margin-top: 4px; flex-wrap: wrap; }
        .hero-btn {
          min-height: 48px; padding: 0 22px; border-radius: 12px; font-size: 15px; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-body);
        }
        .hero-btn.solid { background: var(--cream); color: var(--green); border: none; }
        .hero-btn.ghost { background: transparent; color: var(--cream); border: 1.5px solid rgba(250,248,243,0.5); }
        @media (max-width: 480px) { .hero-btn { flex: 1; } }

        .order-body { display: flex; flex-direction: column; gap: 22px; padding-bottom: 0 !important; }
        @media (min-width: 640px) { .order-body { padding-top: 24px; } }

        .notice {
          display: flex; align-items: flex-start; gap: 10px; border-radius: var(--radius);
          padding: 12px 14px; font-size: 14px; line-height: 1.45;
        }
        .notice.warning { background: var(--warning-bg); color: var(--warning-text); }

        .tracker {
          display: flex; align-items: center; gap: 12px;
          background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 14px 16px; text-decoration: none; color: var(--text-primary);
        }
        .tracker-dot {
          width: 10px; height: 10px; border-radius: 50%; background: var(--red);
          flex-shrink: 0; box-shadow: 0 0 0 4px var(--red-tint);
        }
        .tracker-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .tracker-title { font-size: 15px; font-weight: 700; }
        .tracker-meta { font-size: 13px; color: var(--text-secondary); }

        .search-wrap {
          display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 14px;
          border: 1px solid var(--border); background: var(--surface-1); border-radius: var(--radius);
          color: var(--text-secondary); max-width: 560px;
        }
        .search-input {
          flex: 1; min-width: 0; border: 0; outline: 0; background: transparent;
          font: 400 15px var(--font-body); color: var(--text-primary);
        }
        .search-input::placeholder { color: var(--text-muted); }
        .search-wrap:focus-within { border-color: var(--green); }

        .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .section-head h2, .section-title-lg { font-size: 22px; }
        .section-head span { font-size: 13px; color: var(--text-secondary); }
        .section-title-lg { margin-bottom: 12px; }

        .specials-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 14px; }
        .special-card { background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        .special-photo-wrap { position: relative; }
        .special-photo { width: 100%; height: 168px; object-fit: cover; display: block; }
        .special-photo-empty { background: var(--kraft-soft); color: var(--wood); display: flex; align-items: center; justify-content: center; }
        .special-ribbon {
          position: absolute; right: 12px; bottom: 12px; background: var(--red); color: #fff;
          font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; border-radius: 6px; padding: 5px 9px;
        }
        .special-body { padding: 14px 16px 16px; display: flex; align-items: center; gap: 12px; }
        .special-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .special-name { font-family: var(--font-body); font-size: 16px; font-weight: 700; }
        .special-desc { margin: 0; font-size: 13px; color: var(--text-secondary); }
        .special-price { font-family: var(--font-display); font-size: 18px; font-weight: 600; margin-top: 4px; }

        .category-scroll { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 6px; margin-bottom: 14px; -webkit-overflow-scrolling: touch; }
        .category-scroll::-webkit-scrollbar { display: none; }
        .chip {
          flex-shrink: 0; min-height: 42px; padding: 0 16px; border-radius: 999px; white-space: nowrap;
          border: 1px solid var(--border); background: var(--surface-1); color: var(--text-primary);
          font: 600 14px var(--font-body);
        }
        .chip-active { border-color: var(--green); background: var(--green); color: var(--cream); }

        .order-layout { display: flex; flex-direction: column; gap: 24px; }
        .order-main { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
        @media (min-width: 960px) {
          .order-layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 32px; align-items: start; }
        }

        /* Products: rows on phones (photo left), cards from tablet up. */
        .product-grid { display: flex; flex-direction: column; }
        .product-card {
          display: flex; gap: 14px; align-items: center; padding: 14px 0; border-bottom: 1px solid var(--border);
          background: transparent;
        }
        .product-card-out .product-photo, .product-card-out .product-name { opacity: 0.6; }
        .product-photo-wrap { position: relative; width: 92px; height: 92px; flex-shrink: 0; border-radius: var(--radius); overflow: hidden; }
        .product-photo { width: 100%; height: 100%; object-fit: cover; display: block; }
        .product-photo-empty { background: var(--kraft-soft); color: var(--wood); display: flex; align-items: center; justify-content: center; }
        .product-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .product-name { font-family: var(--font-body); font-size: 15.5px; font-weight: 700; }
        .product-desc { margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.4; }
        .product-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 6px; }
        .product-price { font-size: 15px; font-weight: 700; }
        .product-unit { font-weight: 400; color: var(--text-secondary); font-size: 13px; }
        @media (min-width: 640px) {
          .product-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
          .product-card {
            flex-direction: column; align-items: stretch; gap: 0; padding: 0;
            background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden;
          }
          .product-photo-wrap { width: 100%; height: 170px; border-radius: 0; }
          .product-body { padding: 14px 16px 16px; flex: 1; }
          .product-desc { flex: 1; }
          .product-price { font-family: var(--font-display); font-size: 19px; font-weight: 600; }
        }
        @media (min-width: 1200px) { .product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

        .fav-btn {
          position: absolute; right: 6px; top: 6px; width: 32px; height: 32px; border-radius: 50%;
          background: rgba(255,255,255,0.9); border: none; display: flex; align-items: center; justify-content: center;
          color: var(--text-secondary); z-index: 3;
        }
        .fav-btn.on { color: var(--red); }
        .badge-pop {
          position: absolute; left: 6px; top: 6px; z-index: 2; pointer-events: none;
          background: var(--surface-1); color: var(--wood); font-size: 11.5px; font-weight: 700;
          padding: 3px 8px; border-radius: 6px;
        }
        .gallery-nav { position: absolute; top: 40px; bottom: 0; width: 34%; background: none; border: none; padding: 0; z-index: 1; }
        .gallery-nav.left { left: 0; } .gallery-nav.right { right: 0; }
        .gallery-dots { position: absolute; left: 0; right: 0; bottom: 6px; display: flex; justify-content: center; gap: 4px; z-index: 2; pointer-events: none; }
        .gallery-dots span { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.6); }
        .gallery-dots span.on { background: #fff; width: 12px; border-radius: 3px; }

        .sold-out { font-size: 12.5px; font-weight: 700; color: var(--red); background: var(--red-tint); border-radius: 8px; padding: 8px 10px; white-space: nowrap; }
        .btn-add {
          min-width: 44px; height: 44px; padding: 0 12px; border-radius: 12px; border: 1.5px solid var(--green);
          background: var(--surface-1); color: var(--green); display: inline-flex; align-items: center; justify-content: center; gap: 4px;
          font: 700 14px var(--font-body);
        }
        .btn-add:hover { background: var(--green); color: var(--cream); }
        .btn-add-text { display: none; }
        @media (min-width: 640px) { .btn-add-text { display: inline; } }

        .stepper {
          display: inline-flex; align-items: center; height: 44px; border: 1.5px solid var(--green);
          border-radius: 12px; background: var(--surface-1); color: var(--green); flex-shrink: 0;
        }
        .stepper button { width: 38px; height: 100%; border: 0; background: transparent; color: inherit; font: 700 19px var(--font-body); }
        .stepper span { min-width: 20px; text-align: center; font-weight: 700; color: var(--text-primary); }

        .btn-primary {
          min-height: 44px; padding: 0 18px; border: 0; border-radius: 12px;
          background: var(--green); color: var(--cream); font: 700 14px var(--font-body); white-space: nowrap;
        }

        .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--wood); }
        .eyebrow.light { color: var(--kraft); }
        .cake-promo {
          background: var(--green); color: var(--cream); border-radius: 18px; padding: 22px;
          display: flex; flex-direction: column; gap: 10px; align-items: flex-start;
        }
        .cake-promo h2 { font-size: 26px; line-height: 1.1; color: var(--cream); }
        .cake-promo p { margin: 0 0 4px; font-size: 14.5px; line-height: 1.5; color: var(--on-green-muted); max-width: 52ch; }

        .empty-note { font-size: 14px; color: var(--text-secondary); padding: 8px 0; margin: 0; }

        .custom-cake-form {
          border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; background: var(--surface-1);
          display: flex; flex-direction: column; gap: 8px;
        }
        .custom-cake-title { font-size: 24px; }
        .custom-cake-rate { margin: 0 0 6px; font-size: 14px; color: var(--text-secondary); line-height: 1.5; }
        .custom-cake-fields { display: flex; flex-direction: column; gap: 12px; }
        .custom-cake-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .custom-cake-price { font-family: var(--font-display); font-size: 24px; font-weight: 600; }

        /* Bag + checkout */
        .cart-panel {
          background: var(--surface-1); border: 1px solid var(--border); border-radius: 18px;
          padding: 20px; scroll-margin-top: calc(var(--topbar-h) + 16px);
          display: flex; flex-direction: column; gap: 16px;
        }
        @media (min-width: 960px) { .cart-panel { position: sticky; top: calc(var(--topbar-h) + 20px); max-height: calc(100vh - var(--topbar-h) - 40px); overflow-y: auto; } }
        .cart-title { font-size: 22px; }
        .cart-list { display: flex; flex-direction: column; }
        .cart-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .cart-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .cart-row-name { font-size: 14.5px; font-weight: 700; }
        .cart-row-detail { font-size: 12.5px; color: var(--text-secondary); overflow-wrap: anywhere; }
        .cart-row-total { min-width: 56px; text-align: right; font-weight: 600; font-size: 14px; }

        .checkout-step { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
        .checkout-step legend {
          padding: 0; margin-bottom: 10px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--text-secondary);
        }
        .segmented { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .segment {
          min-height: 60px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-1);
          text-align: left; padding: 8px 14px; display: flex; flex-direction: column; justify-content: center; gap: 2px;
          font: 600 15px var(--font-body); color: var(--text-primary);
        }
        .segment small { font-weight: 400; font-size: 12px; color: var(--text-secondary); }
        .segment.on { border: 2px solid var(--green); background: var(--green-tint); color: var(--green); }

        .option-list { display: flex; flex-direction: column; gap: 8px; }
        .option {
          display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px;
          border: 1px solid var(--border); background: var(--surface-1); cursor: pointer;
        }
        .option.on { border: 2px solid var(--green); padding: 11px 13px; }
        .option input { width: 20px; height: 20px; margin: 0; accent-color: var(--green); flex-shrink: 0; }
        .option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .option-text span { font-weight: 600; font-size: 14px; }
        .option-text small { font-size: 12px; color: var(--text-secondary); }
        .option-fee { font-weight: 700; font-size: 14px; }

        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 13.5px; font-weight: 600; }
        .field-hint { font-weight: 400; color: var(--text-secondary); }
        .field-input {
          width: 100%; min-height: 46px; padding: 10px 14px; font: 400 15px var(--font-body); color: var(--text-primary);
          border: 1px solid var(--border); border-radius: 12px; background: var(--surface-1); box-sizing: border-box;
        }
        .field-input:focus { border-color: var(--green); outline: none; }
        .field-textarea { resize: vertical; }
        .phone-input {
          display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 14px;
          border: 1px solid var(--border); border-radius: 12px; background: var(--surface-1);
        }
        .phone-input:focus-within { border-color: var(--green); }
        .phone-input input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: 400 15px var(--font-body); color: var(--text-primary); }

        .day-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
        .day-chip {
          flex-shrink: 0; min-height: 44px; padding: 0 16px; border-radius: 999px; white-space: nowrap;
          border: 1px solid var(--border); background: var(--surface-1); color: var(--text-primary); font: 600 14px var(--font-body);
        }
        .day-chip.on { border-color: var(--green); background: var(--green); color: var(--cream); }
        .day-chip:disabled { border-style: dashed; color: var(--text-muted); background: transparent; cursor: not-allowed; }
        .slot-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .slot {
          min-height: 44px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-1);
          color: var(--text-primary); font: 600 14px var(--font-body);
        }
        .slot.on { border: 2px solid var(--green); background: var(--green-tint); color: var(--green); }

        .delivery-note { font-size: 13px; color: var(--text-secondary); margin: 0; }
        .summary {
          background: var(--surface-0); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 8px; font-size: 14px;
        }
        .summary > div { display: flex; justify-content: space-between; gap: 12px; }
        .summary > div > span:first-child { color: var(--text-secondary); }
        .summary-total { border-top: 1px solid var(--border); padding-top: 10px; margin-top: 2px; }
        .summary-total span:first-child { color: var(--text-primary) !important; font-weight: 700; }
        .summary-total span:last-child { font-family: var(--font-display); font-size: 21px; font-weight: 600; }

        .checkout-error { font-size: 13.5px; color: var(--red); margin: 0; }
        .missing-note { font-size: 13px; color: var(--text-secondary); margin: 0; }
        .btn-checkout {
          width: 100%; min-height: 54px; font: 700 16px var(--font-body); border: none; border-radius: 14px;
          background: var(--green); color: var(--cream); box-sizing: border-box;
          display: flex; align-items: center; justify-content: center; text-decoration: none;
        }
        .btn-checkout:disabled { background: var(--surface-2); color: var(--text-muted); cursor: not-allowed; }
        .btn-secondary {
          width: 100%; min-height: 48px; font: 600 15px var(--font-body); background: var(--sand); color: var(--text-primary);
          border: 0; border-radius: 12px; display: flex; align-items: center; justify-content: center; text-decoration: none;
        }
        .btn-text { border: 0; background: none; color: var(--green); font: 600 14px var(--font-body); min-height: 44px; }

        .login-prompt { font-size: 14px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
        .login-prompt a { color: var(--green); font-weight: 700; }

        .login-gate {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          gap: 10px; padding: 24px 20px; margin: 8px 0;
          background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius-lg);
        }
        .login-gate-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--text-primary); }
        .login-gate-sub { margin: 0; font-size: 13px; color: var(--text-secondary); }
        .login-gate .btn-checkout { width: 100%; text-align: center; }
        .login-gate .btn-secondary { width: 100%; text-align: center; }

        .placed-order-card { display: flex; flex-direction: column; gap: 10px; align-items: stretch; text-align: center; }
        .placed-icon {
          align-self: center; width: 48px; height: 48px; border-radius: 24px; background: var(--green-tint); color: var(--green);
          display: flex; align-items: center; justify-content: center;
        }
        .placed-order-title { margin: 0; font-family: var(--font-display); font-size: 22px; font-weight: 600; }
        .placed-order-meta { margin: 0 0 6px; font-size: 14px; color: var(--text-secondary); line-height: 1.5; }

        .mobile-cart-bar {
          position: fixed; bottom: calc(var(--tabbar-h) + 12px + env(safe-area-inset-bottom, 0px)); left: 12px; right: 12px;
          min-height: 56px; background: var(--green); color: var(--cream); border: none;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 0 18px; border-radius: 16px; z-index: 19; font: 600 14px var(--font-body);
          box-shadow: 0 8px 24px rgba(31,61,46,0.28);
        }
        .mobile-cart-cta { font-weight: 700; font-size: 15px; display: inline-flex; align-items: center; gap: 6px; }
        @media (min-width: 960px) { .mobile-cart-bar { display: none; } }
      `}</style>
    </div>
  );
}
