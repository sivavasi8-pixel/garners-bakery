import { Routes, Route } from "react-router-dom";
import TopNav from "./components/TopNav";
import ProtectedRoute from "./auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Staff from "./pages/Staff";
import Order from "./pages/Order";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MenuAdmin from "./pages/MenuAdmin";
import MyOrders from "./pages/MyOrders";
import Reports from "./pages/Reports";
import POS from "./pages/POS";
import Receipt from "./pages/Receipt";
import Orders from "./pages/Orders";

export default function App() {
  return (
    <div>
      <TopNav />
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute roles={["owner", "staff"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute roles={["owner", "staff"]}>
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute roles={["owner", "staff"]}>
              <Staff />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute roles={["owner", "staff"]}>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute roles={["owner", "staff"]}>
              <POS />
            </ProtectedRoute>
          }
        />
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
          path="/my-orders"
          element={
            <ProtectedRoute roles={["customer"]}>
              <MyOrders />
            </ProtectedRoute>
          }
        />
        {/* Any logged-in role — the backend enforces a customer can only fetch their own order */}
        <Route
          path="/receipt/:id"
          element={
            <ProtectedRoute>
              <Receipt />
            </ProtectedRoute>
          }
        />
        {/* Browsing the menu stays public; Order.jsx itself gates checkout on being logged in as a customer */}
        <Route path="/order" element={<Order />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </div>
  );
}
