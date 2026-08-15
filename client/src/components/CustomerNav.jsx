import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function CustomerNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const customerTabs = [
    { to: "/order", label: "Order", iconClass: "ti-shopping-bag" },
    ...(user?.role === "customer" ? [{ to: "/my-orders", label: "My orders", iconClass: "ti-receipt" }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-0)" }}>
      {/* Desktop / tablet top bar */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-badge">G</div>
            <div>
              <p className="brand-name">GARNERS</p>
              <p className="brand-sub">Cakes &amp; Breads</p>
            </div>
          </div>

          <nav className="topbar-nav">
            <NavLink to="/order" className={({ isActive }) => `topbar-link${isActive ? " active" : ""}`}>Order online</NavLink>
            {user?.role === "customer" && (
              <NavLink to="/my-orders" className={({ isActive }) => `topbar-link${isActive ? " active" : ""}`}>My orders</NavLink>
            )}
            <a href="/handbook.html" target="_blank" rel="noopener noreferrer" className="topbar-link">Guide</a>
          </nav>

          <div className="topbar-right">
            {user ? (
              <>
                <span className="topbar-user">{user.name}</span>
                <button className="btn-outline-inverse" onClick={handleLogout}>Log out</button>
              </>
            ) : (
              <NavLink to="/login" className="btn-solid" style={{ textDecoration: "none", display: "inline-block" }}>Log in</NavLink>
            )}
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
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand-badge {
          width: 34px; height: 34px; border-radius: 50%;
          border: 1.5px solid var(--gold);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 13px; flex-shrink: 0;
        }
        .brand-name {
          margin: 0; font-family: var(--font-display); font-size: 16px;
          letter-spacing: 0.4px; line-height: 1.1;
        }
        .brand-sub { margin: 0; font-size: 10px; opacity: 0.7; line-height: 1.1; }

        .topbar-nav { display: none; gap: 4px; }
        .topbar-link {
          padding: 8px 14px; border-radius: 8px; font-size: 14px;
          text-decoration: none; color: rgba(250,248,243,0.75);
        }
        .topbar-link.active { color: var(--cream); background: rgba(250,248,243,0.12); }

        .topbar-right { display: none; align-items: center; gap: 10px; }
        .topbar-user { font-size: 13px; opacity: 0.85; }
        .btn-solid {
          background: var(--gold); color: var(--green-dark); border: none;
          padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
        }
        .btn-outline-inverse {
          background: transparent; color: var(--cream);
          border: 1px solid rgba(250,248,243,0.4);
          padding: 7px 14px; border-radius: 8px; font-size: 13px;
        }

        @media (min-width: 720px) {
          .topbar-nav { display: flex; }
          .topbar-right { display: flex; }
        }

        .tabbar {
          position: fixed; bottom: 0; left: 0; right: 0;
          height: var(--tabbar-h);
          background: var(--surface-1);
          border-top: 1px solid var(--border);
          display: flex;
          overflow-x: auto;
          z-index: 20;
        }
        .tabbar-item {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 3px; text-decoration: none;
          color: var(--text-muted); font-size: 11px; min-width: 56px;
          border: none; background: none; padding: 6px 4px;
        }
        .tabbar-item i { font-size: 20px; }
        .tabbar-item.active { color: var(--green); }

        @media (min-width: 720px) {
          .tabbar { display: none; }
        }
      `}</style>
    </div>
  );
}
