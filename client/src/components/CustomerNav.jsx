import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import PushToggle from "./PushToggle";

export default function CustomerNav() {
  const { user, logout } = useAuth();
  const { count: cartCount } = useCart();
  const navigate = useNavigate();
  const isShopUser = user?.role === "owner" || user?.role === "staff";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const customerTabs = [
    { to: "/order", label: "Menu", iconClass: "ti-bread", end: true },
    ...(user?.role === "customer" ? [{ to: "/my-orders", label: "My orders", iconClass: "ti-receipt" }] : []),
    ...(isShopUser ? [{ to: "/dashboard", label: "Console", iconClass: "ti-layout-dashboard" }] : [])
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-0)" }}>
      <header className="topbar">
        <div className="awning" aria-hidden="true" />
        <div className="topbar-inner">
          <Link to="/order" className="brand" aria-label="GARNERS Cakes & Breads, home">
            <span className="brand-name">GARNERS</span>
            <span className="brand-sub">Cakes &amp; Breads</span>
          </Link>

          <nav className="topbar-nav" aria-label="Main">
            <NavLink to="/order" end className={({ isActive }) => `topbar-link${isActive ? " active" : ""}`}>Menu</NavLink>
            {user?.role === "customer" && (
              <NavLink to="/my-orders" className={({ isActive }) => `topbar-link${isActive ? " active" : ""}`}>My orders</NavLink>
            )}
            {isShopUser && (
              <NavLink to="/dashboard" className="topbar-link">Shop console</NavLink>
            )}
            <a href="/handbook.html" target="_blank" rel="noopener noreferrer" className="topbar-link">Guide</a>
          </nav>

          <div className="topbar-right">
            {user ? (
              <>
                {/* Only customers need their own order's status pushed to them —
                    owner/staff get the same toggle in the admin shell instead. */}
                {user.role === "customer" && <PushToggle className="topbar-ghost" />}
                <span className="topbar-user">{user.name}</span>
                <button className="topbar-ghost" onClick={handleLogout}>Log out</button>
              </>
            ) : (
              <NavLink to="/login" className="topbar-ghost">Log in</NavLink>
            )}
            <Link to="/order#bag" className="bag-btn" aria-label={`Your bag, ${cartCount} item${cartCount === 1 ? "" : "s"}`}>
              <i className="ti ti-shopping-bag" aria-hidden="true" />
              {cartCount > 0 && <span className="bag-count">{cartCount}</span>}
            </Link>
          </div>
        </div>
      </header>

      <Outlet />

      {/* Mobile bottom tab bar */}
      <nav className="tabbar" aria-label="Primary">
        {customerTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `tabbar-item${isActive ? " active" : ""}`}
          >
            <i className={`ti ${tab.iconClass}`} aria-hidden="true" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
        <a href="/handbook.html" target="_blank" rel="noopener noreferrer" className="tabbar-item">
          <i className="ti ti-book" aria-hidden="true" />
          <span>Guide</span>
        </a>
        {user ? (
          <button className="tabbar-item" onClick={handleLogout}>
            <i className="ti ti-logout" aria-hidden="true" />
            <span>Log out</span>
          </button>
        ) : (
          <NavLink to="/login" className={({ isActive }) => `tabbar-item${isActive ? " active" : ""}`}>
            <i className="ti ti-login" aria-hidden="true" />
            <span>Log in</span>
          </NavLink>
        )}
      </nav>

      <style>{`
        .topbar {
          background: var(--green);
          color: var(--cream);
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .topbar-inner {
          height: var(--topbar-h);
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        @media (min-width: 960px) { .topbar-inner { padding: 0 32px; } }

        /* Two-tier wordmark: bold spaced caps over the italic tagline, as on the real labels. */
        .brand { display: flex; flex-direction: column; line-height: 1; text-decoration: none; color: var(--cream); }
        .brand-name { font-family: var(--font-display); font-weight: 700; font-size: 21px; letter-spacing: 0.14em; }
        .brand-sub { font-family: var(--font-display); font-style: italic; font-size: 12.5px; opacity: 0.85; margin-top: 3px; }

        .topbar-nav { display: none; gap: 4px; flex: 1; margin-left: 24px; }
        .topbar-link {
          padding: 10px 14px; font-size: 15px; font-weight: 500;
          text-decoration: none; color: var(--on-green-muted); border-bottom: 2px solid transparent;
        }
        .topbar-link:hover { color: var(--cream); }
        .topbar-link.active { color: var(--cream); font-weight: 700; border-bottom-color: var(--kraft); }

        .topbar-right { display: flex; align-items: center; gap: 10px; }
        .topbar-user { display: none; font-size: 14px; color: var(--on-green-muted); }
        .topbar-ghost {
          display: none; background: transparent; color: var(--cream); text-decoration: none;
          border: 1px solid rgba(250,248,243,0.4); padding: 9px 14px; border-radius: 10px; font-size: 14px; font-weight: 600;
        }
        .bag-btn {
          position: relative; width: 44px; height: 44px; border-radius: 22px;
          background: var(--cream); color: var(--green); display: flex; align-items: center; justify-content: center;
          text-decoration: none;
        }
        .bag-btn i { font-size: 21px; }
        .bag-count {
          position: absolute; top: -3px; right: -3px; min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box;
          border-radius: 10px; background: var(--red); color: #fff; font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }

        @media (min-width: 720px) {
          .topbar-nav { display: flex; }
          .topbar-user { display: inline; }
          .topbar-ghost { display: inline-block; }
        }

        .tabbar {
          position: fixed; bottom: 0; left: 0; right: 0;
          height: var(--tabbar-h);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: var(--surface-1);
          border-top: 1px solid var(--border);
          display: flex;
          z-index: 20;
        }
        .tabbar-item {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 3px; text-decoration: none;
          color: var(--text-secondary); font-size: 11.5px; font-weight: 600; min-width: 56px;
          border: none; background: none; padding: 6px 4px; font-family: var(--font-body);
        }
        .tabbar-item i { font-size: 21px; }
        .tabbar-item.active { color: var(--green); }

        @media (min-width: 720px) {
          .tabbar { display: none; }
        }
      `}</style>
    </div>
  );
}
