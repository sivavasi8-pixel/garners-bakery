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
  const isStaffSide = user && user.role !== "customer";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      style={{
        background: "var(--green)",
        color: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 28px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            fontSize: "13px"
          }}
        >
          G
        </div>
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "17px",
              letterSpacing: "0.5px"
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
              opacity: 0.75
            }}
          >
            Cakes &amp; Breads
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <nav style={{ display: "flex", gap: "6px" }}>
          {isStaffSide && (
            <>
              <NavLink to="/" style={linkStyle} end>Dashboard</NavLink>
              <NavLink to="/pos" style={linkStyle}>POS</NavLink>
              <NavLink to="/orders" style={linkStyle}>Orders</NavLink>
              <NavLink to="/inventory" style={linkStyle}>Inventory</NavLink>
              <NavLink to="/staff" style={linkStyle}>Staff</NavLink>
            </>
          )}
          {user?.role === "owner" && (
            <>
              <NavLink to="/menu-admin" style={linkStyle}>Menu</NavLink>
              <NavLink to="/reports" style={linkStyle}>Reports</NavLink>
            </>
          )}
          <NavLink to="/order" style={linkStyle}>Order online</NavLink>
          {user?.role === "customer" && (
            <NavLink to="/my-orders" style={linkStyle}>My orders</NavLink>
          )}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
          {user ? (
            <>
              <NotificationBell />
              <span style={{ opacity: 0.85 }}>
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
    </header>
  );
}
