import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { setupForegroundPushListener } from "./push";
import CustomerNav from "./components/CustomerNav";
import AdminLayout from "./components/admin/AdminLayout";
import ProtectedRoute from "./auth/ProtectedRoute";
import { CartProvider } from "./cart/CartContext";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Staff from "./pages/Staff";
import Order from "./pages/Order";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import MenuAdmin from "./pages/MenuAdmin";
import MyOrders from "./pages/MyOrders";
import MyAccount from "./pages/MyAccount";
import Reports from "./pages/Reports";
import POS from "./pages/POS";
import Receipt from "./pages/Receipt";
import Orders from "./pages/Orders";
import Poster from "./pages/Poster";
import Customers from "./pages/Customers";
import DeliveryPartners from "./pages/DeliveryPartners";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

export default function App() {
  const { user } = useAuth();

  // Only matters once logged in (a push is always addressed to a user id or
  // role) — safe to call again on every login since it just adds a listener.
  useEffect(() => {
    if (user) setupForegroundPushListener();
  }, [user]);

  return (
    <Routes>
      {/* Customer storefront shell: warm retail look (CustomerNav + theme.css).
          Browsing the menu stays public; Order.jsx itself gates checkout on
          being logged in as a customer. */}
      <Route element={<CartProvider><CustomerNav /></CartProvider>}>
        {/* The menu is the storefront's front door — a shared WhatsApp/Instagram link
            to the root URL used to land on the owner/staff login instead. A redirect
            (not a duplicate route) so the address bar and nav active-state agree. */}
        <Route path="/" element={<Navigate to="/order" replace />} />
        <Route path="/order" element={<Order />} />
        <Route
          path="/my-orders"
          element={
            <ProtectedRoute roles={["customer"]}>
              <MyOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-account"
          element={
            <ProtectedRoute roles={["customer"]}>
              <MyAccount />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Owner/staff backend shell: clean software look (AdminLayout + admin-theme.css) */}
      <Route
        element={
          <ProtectedRoute roles={["owner", "staff"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/customers" element={<Customers />} />
        <Route
          path="/menu-admin"
          element={
            <ProtectedRoute roles={["owner"]}>
              <MenuAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute roles={["owner"]}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/delivery-partners"
          element={
            <ProtectedRoute roles={["owner"]}>
              <DeliveryPartners />
            </ProtectedRoute>
          }
        />
        {/* Owner and staff: whoever posts the morning banner in the WhatsApp group. */}
        <Route path="/poster" element={<Poster />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={["owner"]}>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Delivery partners: their own standalone shell, not the admin console or
          the customer storefront — a single-page claim/deliver dashboard. */}
      <Route
        path="/delivery"
        element={
          <ProtectedRoute roles={["delivery"]}>
            <DeliveryDashboard />
          </ProtectedRoute>
        }
      />

      {/* Any logged-in role — the backend enforces a customer can only fetch their own
          order. Standalone (no shell chrome): it's a print-friendly receipt, and both
          nav shells are hidden on print anyway. */}
      <Route
        path="/receipt/:id"
        element={
          <ProtectedRoute>
            <Receipt />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
