const BASE = "/api";

let authToken = null;
export function setAuthToken(token) {
  authToken = token;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  // Skip the JSON content-type for FormData (image uploads) — the browser needs to set its
  // own multipart boundary, and overriding it here would break the upload silently.
  const isFormData = options.body instanceof FormData;
  const isGet = !options.method || options.method === "GET";
  // Render's free tier spins the server down after idle and takes 30-60s to wake
  // on the next request — the request that happens to land during that window
  // fails outright with a network-level "Failed to fetch", not an HTTP error, so
  // it never even reaches the `!res.ok` check below. Retrying a GET (safe to
  // repeat) after a short wait usually succeeds once the server's awake; a
  // mutating request is never auto-retried, since a network failure doesn't
  // guarantee the server never received it.
  const maxAttempts = isGet ? 3 : 1;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await fetch(`${BASE}${path}`, {
        headers: {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        ...options
      });
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await sleep(attempt * 1500);
        continue;
      }
      throw new Error("Couldn't reach the server — check your connection and try again.");
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }
  throw lastErr;
}

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  signup: (name, email, password, phone, pin) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password, phone, pin }) }),
  me: () => request("/auth/me"),
  updateProfile: (name, phone) => request("/auth/me", { method: "PATCH", body: JSON.stringify({ name, phone }) }),
  changePassword: (currentPassword, newPassword) =>
    request("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  changePin: (currentPassword, newPin) =>
    request("/auth/change-pin", { method: "POST", body: JSON.stringify({ currentPassword, newPin }) }),
  resetPassword: (email, pin, newPassword) =>
    request("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, pin, newPassword }) }),
  requestPinReset: (email) =>
    request("/auth/request-pin-reset", { method: "POST", body: JSON.stringify({ email }) }),

  getDashboardSummary: () => request("/dashboard/summary"),
  getMenu: (category) => request(`/menu${category ? `?category=${category}` : ""}`),
  createMenuItem: (formData) => request("/menu", { method: "POST", body: formData }),
  updateMenuItem: (id, formData) => request(`/menu/${id}`, { method: "PATCH", body: formData }),
  deleteMenuItem: (id) => request(`/menu/${id}`, { method: "DELETE" }),
  updateMenuAvailability: (id, inStock) =>
    request(`/menu/${id}/availability`, { method: "PATCH", body: JSON.stringify({ inStock }) }),
  updateMenuSpecial: (id, isSpecial) =>
    request(`/menu/${id}/special`, { method: "PATCH", body: JSON.stringify({ isSpecial }) }),
  updateMenuPopular: (id, isPopular) =>
    request(`/menu/${id}/popular`, { method: "PATCH", body: JSON.stringify({ isPopular }) }),
  addMenuGalleryImage: (id, formData) => request(`/menu/${id}/images`, { method: "POST", body: formData }),
  deleteMenuGalleryImage: (id, imageId) => request(`/menu/${id}/images/${imageId}`, { method: "DELETE" }),

  getStoreStatus: () => request("/orders/store-status"),
  getOrders: () => request("/orders"),
  getMyOrders: () => request("/orders/mine"),
  getOrder: (id) => request(`/orders/${id}`),
  createOrder: (order) => request("/orders", { method: "POST", body: JSON.stringify(order) }),
  updateOrderStatus: (id, status) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  updateOrderPayment: (id, paymentStatus) =>
    request(`/orders/${id}/payment`, { method: "PATCH", body: JSON.stringify({ paymentStatus }) }),
  updateOrderPickupTime: (id, pickupTime) =>
    request(`/orders/${id}/pickup-time`, { method: "PATCH", body: JSON.stringify({ pickupTime }) }),
  updateOrderPriority: (id, priority) =>
    request(`/orders/${id}/priority`, { method: "PATCH", body: JSON.stringify({ priority }) }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: "PATCH" }),

  getInventory: () => request("/inventory"),
  createInventoryItem: (item) => request("/inventory", { method: "POST", body: JSON.stringify(item) }),
  updateInventoryItem: (id, item) => request(`/inventory/${id}`, { method: "PATCH", body: JSON.stringify(item) }),
  updateInventoryQuantity: (id, quantity) =>
    request(`/inventory/${id}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
  deleteInventoryItem: (id) => request(`/inventory/${id}`, { method: "DELETE" }),

  getStaff: () => request("/staff"),
  createStaffMember: (member) => request("/staff", { method: "POST", body: JSON.stringify(member) }),
  deleteStaffMember: (id) => request(`/staff/${id}`, { method: "DELETE" }),
  updateStaffStatus: (id, status) =>
    request(`/staff/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  updateStaffShift: (id, shift) =>
    request(`/staff/${id}/shift`, { method: "PATCH", body: JSON.stringify({ shift }) }),
  getTasks: () => request("/staff/tasks"),
  createTask: (task) => request("/staff/tasks", { method: "POST", body: JSON.stringify(task) }),
  updateTask: (id, fields) => request(`/staff/tasks/${id}`, { method: "PATCH", body: JSON.stringify(fields) }),
  deleteTask: (id) => request(`/staff/tasks/${id}`, { method: "DELETE" }),

  getReports: () => request("/reports/summary"),

  getRecipe: (menuItemId) => request(`/menu/${menuItemId}/recipe`),
  updateRecipe: (menuItemId, ingredients) =>
    request(`/menu/${menuItemId}/recipe`, { method: "PUT", body: JSON.stringify({ ingredients }) }),


  getExpenses: () => request("/expenses"),
  createExpense: (expense) => request("/expenses", { method: "POST", body: JSON.stringify(expense) }),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: "DELETE" }),

  getCustomers: () => request("/customers"),
  adminResetCustomerPin: (id, newPin) =>
    request(`/customers/${id}/reset-pin`, { method: "POST", body: JSON.stringify({ newPin }) }),
  adminResetCustomerPassword: (id, newPassword) =>
    request(`/customers/${id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }),

  registerPushToken: (token) => request("/push/register", { method: "POST", body: JSON.stringify({ token }) }),
  unregisterPushToken: (token) => request("/push/unregister", { method: "POST", body: JSON.stringify({ token }) }),

  getAddresses: () => request("/addresses"),
  createAddress: (address) => request("/addresses", { method: "POST", body: JSON.stringify(address) }),
  updateAddress: (id, fields) => request(`/addresses/${id}`, { method: "PATCH", body: JSON.stringify(fields) }),
  deleteAddress: (id) => request(`/addresses/${id}`, { method: "DELETE" }),
  setDefaultAddress: (id) => request(`/addresses/${id}/default`, { method: "PATCH" }),
  reverseGeocode: (lat, lng) => request("/addresses/reverse-geocode", { method: "POST", body: JSON.stringify({ lat, lng }) }),

  getAvailableDeliveries: () => request("/delivery/orders/available"),
  getMyDeliveries: () => request("/delivery/orders/mine"),
  claimDelivery: (id) => request(`/delivery/orders/${id}/claim`, { method: "PATCH" }),
  releaseDelivery: (id) => request(`/delivery/orders/${id}/release`, { method: "PATCH" }),
  markDelivered: (id) => request(`/delivery/orders/${id}/delivered`, { method: "PATCH" }),

  getDeliveryPartners: () => request("/delivery-partners"),
  createDeliveryPartner: (partner) => request("/delivery-partners", { method: "POST", body: JSON.stringify(partner) }),
  deleteDeliveryPartner: (id) => request(`/delivery-partners/${id}`, { method: "DELETE" }),

  getSettings: () => request("/settings"),
  updateSettings: (fields) => request("/settings", { method: "PATCH", body: JSON.stringify(fields) }),

  uploadReceipt: (orderId, file) => {
    const body = new FormData();
    body.append("receipt", file);
    return request(`/orders/${orderId}/receipt`, { method: "POST", body });
  },
  // Bypasses request() — this returns image bytes, not JSON, and the <img> it
  // feeds needs a blob: URL since a plain <img src> can't carry the auth header.
  getReceiptBlob: async (orderId) => {
    const res = await fetch(`${BASE}/orders/${orderId}/receipt`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
    });
    if (!res.ok) throw new Error("Couldn't load the receipt");
    return res.blob();
  }
};
