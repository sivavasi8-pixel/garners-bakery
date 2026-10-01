import { createContext, useContext, useState } from "react";

// Cart state shared between Order.jsx (owns checkout) and CustomerNav (just needs
// the count for the nav badge) — frontend-only, nothing here is persisted or synced
// to the server; a real order isn't created until checkout actually calls the API.
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { ...item, qty: 1, menuItemId: item.id }];
    });
  };

  const addCustomItem = (entry) => setCart((prev) => [...prev, entry]);

  // −/+ steppers: change a line's quantity by `delta`; a line that reaches 0 is removed.
  const changeQty = (id, delta) =>
    setCart((prev) =>
      prev.flatMap((c) => {
        if (c.id !== id) return [c];
        const qty = c.qty + delta;
        return qty > 0 ? [{ ...c, qty }] : [];
      })
    );

  const clearCart = () => setCart([]);

  const total = cart.reduce((sum, c) => sum + (c.price || 0) * c.qty, 0);
  const count = cart.reduce((n, c) => n + c.qty, 0);

  return (
    <CartContext.Provider value={{ cart, setCart, addToCart, addCustomItem, changeQty, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside a CartProvider");
  return ctx;
}
