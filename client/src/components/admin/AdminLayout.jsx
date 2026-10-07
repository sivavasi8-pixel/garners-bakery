import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import NotificationBell from "../NotificationBell";
import PushToggle from "../PushToggle";

// Owner-only items are filtered in at render time (see navItems below) —
// staff never sees Menu/Reports, matching the real role gate on those routes.
const allNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: "ti-layout-dashboard", end: true },
  { to: "/pos", label: "POS", icon: "ti-cash-register" },
  { to: "/orders", label: "Orders", icon: "ti-clipboard-list" },
  { to: "/inventory", label: "Inventory", icon: "ti-package" },
  { to: "/staff", label: "Staff", icon: "ti-users" },
  { to: "/customers", label: "Customers", icon: "ti-address-book" },
  { to: "/delivery-partners", label: "Delivery", icon: "ti-truck-delivery", ownerOnly: true },
  { to: "/menu-admin", label: "Menu", icon: "ti-tools-kitchen-2", ownerOnly: true },
  { to: "/poster", label: "Poster", icon: "ti-photo" },
  { to: "/reports", label: "Reports", icon: "ti-chart-bar", ownerOnly: true },
  { to: "/settings", label: "Settings", icon: "ti-settings", ownerOnly: true }
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = allNavItems.filter((n) => !n.ownerOnly || user?.role === "owner");

  const handleLogout = () => {
    if (!window.confirm("Log out of your account?")) return;
    logout();
    navigate("/login");
  };

  return (
    <div className="admin-root admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-awning" aria-hidden="true" />
        <div className="admin-sidebar-brand">
          <p className="admin-sidebar-name">GARNERS</p>
          <p className="admin-sidebar-sub">Shop console</p>
        </div>

        {navItems.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `admin-nav-item${isActive ? " active" : ""}`}
          >
            <i className={`ti ${n.icon}`} aria-hidden="true" />
            <span>{n.label}</span>
          </NavLink>
        ))}

        <div className="admin-sidebar-footer">
          <a href="/order" className="admin-nav-item">
            <i className="ti ti-building-store" aria-hidden="true" />
            <span>View shop</span>
          </a>
          <div className="admin-sidebar-bell">
            <NotificationBell align="left" openUpward />
          </div>
          <PushToggle className="admin-nav-item" />
          <div className="admin-sidebar-user">
            {user?.name} <span>{user?.email}</span>
          </div>
          <button className="admin-nav-item admin-logout" onClick={handleLogout}>
            <i className="ti ti-logout" aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <MobileTopbar navItems={navItems} onLogout={handleLogout} />
        <Outlet />
        <MobileTabbar navItems={navItems} />
      </div>

      <style>{`
        .admin-shell { display: flex; min-height: 100vh; }

        .admin-sidebar {
          width: var(--a-sidebar-w); background: var(--a-sidebar); color: var(--a-sidebar-text);
          flex-shrink: 0; padding: 0 12px 16px; display: none; flex-direction: column;
          /* Pinned to the viewport, not stretched to match a long page (e.g. the
             full Menu list) — without this, a flex row's default stretch makes
             the sidebar as tall as its content sibling, and margin-top:auto on
             the footer pushes Log out/notifications far below the fold.
             position:fixed rather than sticky — theme.css's global
             overflow-x:hidden safety net implicitly computes overflow-y to
             auto on html/body (a CSS spec quirk: setting one overflow axis to
             non-visible forces the other off "visible" too), which breaks
             sticky's scroll-container detection here. Fixed sidesteps that
             entirely; .admin-main below reserves the space with a margin.
             No overflow-y here (deliberately) — it clips the notification
             dropdown, which is position:absolute inside this sidebar and
             needs to render outside the sidebar's own box. The nav content
             (logo + 7 items + footer) comfortably fits 100vh regardless. */
          position: fixed; top: 0; left: 0; height: 100vh; z-index: 25;
        }
        @media (min-width: 900px) { .admin-sidebar { display: flex; } }

        .admin-awning {
          height: 5px; margin: 0 -12px;
          background: repeating-linear-gradient(90deg, #a13a2e 0 14px, var(--a-sidebar) 14px 28px);
        }
        .admin-sidebar-brand { padding: 22px 10px 24px; }
        .admin-sidebar-name {
          margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 21px;
          letter-spacing: 0.14em; color: #faf8f3; line-height: 1;
        }
        .admin-sidebar-sub { margin: 5px 0 0; font-family: var(--font-display); font-style: italic; font-size: 12.5px; color: var(--a-sidebar-text); }

        .admin-nav-item {
          display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 12px; border-radius: 10px;
          font-size: 15px; font-weight: 500; color: var(--a-sidebar-text); text-decoration: none; background: none; border: none;
          width: 100%; text-align: left; box-sizing: border-box; font-family: var(--font-body);
        }
        .admin-nav-item i { font-size: 19px; width: 20px; }
        .admin-nav-item:hover { background: var(--a-sidebar-hover); color: #faf8f3; }
        .admin-nav-item.active { background: var(--a-sidebar-active); color: #faf8f3; font-weight: 700; }
        .admin-nav-item.active i { color: var(--a-accent); }
        .admin-logout { cursor: pointer; }

        .admin-sidebar-footer { margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(250,248,243,0.14); }
        .admin-sidebar-bell { padding: 4px 12px 8px; }
        .admin-sidebar-user { font-size: 13px; font-weight: 600; color: #faf8f3; padding: 6px 12px; overflow-wrap: anywhere; }
        .admin-sidebar-user span { display: block; color: var(--a-sidebar-text); font-size: 12px; font-weight: 400; }

        .admin-main { flex: 1; min-width: 0; }
        @media (min-width: 900px) { .admin-main { margin-left: var(--a-sidebar-w); } }
      `}</style>
    </div>
  );
}

function MobileTopbar({ navItems, onLogout }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="admin-mobile-topbar-wrap">
      <div className="admin-mobile-topbar">
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "0.14em" }}>GARNERS</span>
          {/* Visible at a glance, not just after opening the menu — which account
              someone's in shouldn't require an extra tap to confirm. */}
          <span
            title={user?.name}
            style={{
              fontSize: 12, color: "var(--a-sidebar-text)", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90
            }}
          >
            {user?.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NotificationBell />
          <button
            className="admin-mobile-menu-btn"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            <i className={`ti ${open ? "ti-x" : "ti-menu-2"}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <div className="admin-mobile-panel">
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `admin-nav-item${isActive ? " active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <i className={`ti ${n.icon}`} aria-hidden="true" />
              <span>{n.label}</span>
            </NavLink>
          ))}
          <a href="/order" className="admin-nav-item">
            <i className="ti ti-building-store" aria-hidden="true" />
            <span>View shop</span>
          </a>
          <PushToggle className="admin-nav-item" />
          <div className="admin-sidebar-user">
            {user?.name} <span>{user?.email}</span>
          </div>
          <button className="admin-nav-item admin-logout" style={{ color: "var(--a-danger-text)" }} onClick={onLogout}>
            <i className="ti ti-logout" aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      )}

      <style>{`
        .admin-mobile-topbar {
          display: flex; background: var(--a-sidebar); color: #faf8f3; height: var(--a-topbar-h);
          align-items: center; justify-content: space-between; padding: 0 12px 0 16px;
          position: sticky; top: 0; z-index: 30;
          border-top: 5px solid transparent;
          border-image: repeating-linear-gradient(90deg, #a13a2e 0 14px, var(--a-sidebar) 14px 28px) 5;
        }
        .admin-mobile-menu-btn {
          border: none; background: none; color: #faf8f3; font-size: 22px; width: 44px; height: 44px;
          display: flex; align-items: center; justify-content: center;
        }
        .admin-mobile-panel {
          background: var(--a-sidebar); padding: 6px 10px 14px; position: sticky; top: var(--a-topbar-h); z-index: 29;
        }

        @media (min-width: 900px) { .admin-mobile-topbar-wrap { display: none; } }
      `}</style>
    </div>
  );
}

function MobileTabbar({ navItems }) {
  return (
    <nav className="admin-mobile-tabbar" aria-label="Admin sections">
      {navItems.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) => `admin-mobile-tab${isActive ? " active" : ""}`}
        >
          <i className={`ti ${n.icon}`} aria-hidden="true" />
          <span>{n.label}</span>
        </NavLink>
      ))}
      <style>{`
        .admin-mobile-tabbar {
          display: flex; position: fixed; bottom: 0; left: 0; right: 0; height: var(--a-tabbar-h);
          background: var(--a-panel); border-top: 1px solid var(--a-border); z-index: 30;
          overflow-x: auto;
        }
        @media (min-width: 900px) { .admin-mobile-tabbar { display: none; } }
        .admin-mobile-tab {
          flex: 0 0 auto; min-width: 70px; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 3px; font-size: 11.5px; font-weight: 600;
          color: var(--a-text-secondary); padding: 0 10px; text-decoration: none;
        }
        .admin-mobile-tab.active { color: var(--a-green); }
        .admin-mobile-tab i { font-size: 20px; }
      `}</style>
    </nav>
  );
}
