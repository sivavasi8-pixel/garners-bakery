import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import NotificationBell from "./NotificationBell";

const linkStyle = ({ isActive }) => ({
  padding: "8px 14px",
  borderRadius: "8px",
  fontSize: "14px",
  textDecoration: "none",
  color: isActive ? "var(--cream)" : "rgba(246,241,228,0.75)",
  background: isActive ? "rgba(246,241,228,0.14)" : "transparent"
});

export default function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isStaffSide = user && user.role !== "customer";

  const handleLogout = () => {
    setMobileOpen(false);
    logout();
    navigate("/login");
  };

  // Built once, rendered twice (desktop row + mobile stacked list) so the two
  // menus can never drift out of sync with each other.
  const navItems = [];
  if (isStaffSide) {
    navItems.push({ to: "/", label: "Dashboard", end: true });
    navItems.push({ to: "/pos", label: "POS" });
    navItems.push({ to: "/orders", label: "Orders" });
    navItems.push({ to: "/inventory", label: "Inventory" });
    navItems.push({ to: "/staff", label: "Staff" });
  }
  if (user?.role === "owner") {
    navItems.push({ to: "/menu-admin", label: "Menu" });
    navItems.push({ to: "/reports", label: "Reports" });
  }
  navItems.push({ to: "/order", label: "Order online" });
  if (user?.role === "customer") {
    navItems.push({ to: "/my-orders", label: "My orders" });
  }

  return (
    <>
      <header
        style={{
          background: "var(--green)",
          color: "var(--cream)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          position: "relative"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1.5px solid var(--kraft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontSize: "13px",
              flexShrink: 0
            }}
          >
            G
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "17px",
                letterSpacing: "0.5px",
                whiteSpace: "nowrap"
              }}
            >
              GARNERS
            </p>
            {/* Mirrors the thin italic/script tagline under the wordmark on real product packaging */}
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: "12px",
                opacity: 0.75,
                whiteSpace: "nowrap"
              }}
            >
              Cakes &amp; Breads
            </p>
          </div>
        </div>

        {/* Desktop: full link row + user info, in one line. Hidden below the breakpoint (see theme.css). */}
        <div className="nav-links-desktop" style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <nav style={{ display: "flex", gap: "6px" }}>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} style={linkStyle}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
            <a
              href="/handbook.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "12px", color: "rgba(246,241,228,0.75)", textDecoration: "none" }}
              title="How to use this app"
            >
              📖 Guide
            </a>
            {user ? (
              <>
                <NotificationBell />
                <span style={{ opacity: 0.85, whiteSpace: "nowrap" }}>
                  {user.name} <span style={{ opacity: 0.6 }}>({user.role})</span>
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    border: "1px solid rgba(246,241,228,0.4)",
                    borderRadius: "8px",
                    background: "transparent",
                    color: "var(--cream)"
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <NavLink to="/login" style={linkStyle}>Log in</NavLink>
            )}
          </div>
        </div>

        {/* Mobile: hamburger toggle only. Hidden above the breakpoint (see theme.css). */}
        <button
          className="nav-toggle"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            border: "1px solid rgba(246,241,228,0.35)",
            borderRadius: "8px",
            background: "transparent",
            color: "var(--cream)",
            fontSize: "17px",
            flexShrink: 0
          }}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* Mobile dropdown panel — same links/actions as the desktop row, stacked. */}
      <div
        className={`nav-mobile-panel${mobileOpen ? " open" : ""}`}
        style={{ background: "var(--green-dark)", color: "var(--cream)", padding: "6px 20px 18px" }}
      >
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={linkStyle}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div
          style={{
            borderTop: "1px solid rgba(246,241,228,0.18)",
            marginTop: "10px",
            paddingTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            fontSize: "13px"
          }}
        >
          <a
            href="/handbook.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "rgba(246,241,228,0.85)", textDecoration: "none" }}
          >
            📖 Guide — how to use this app
          </a>
          {user ? (
            <>
              <span style={{ opacity: 0.85 }}>
                Signed in as {user.name} <span style={{ opacity: 0.6 }}>({user.role})</span>
              </span>
              <button
                onClick={handleLogout}
                style={{
                  padding: "8px 12px",
                  fontSize: "13px",
                  border: "1px solid rgba(246,241,228,0.4)",
                  borderRadius: "8px",
                  background: "transparent",
                  color: "var(--cream)",
                  alignSelf: "flex-start"
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login" style={linkStyle} onClick={() => setMobileOpen(false)}>Log in</NavLink>
          )}
        </div>
      </div>
    </>
  );
}
