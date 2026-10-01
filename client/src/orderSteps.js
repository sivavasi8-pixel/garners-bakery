// Shared by the Dashboard queue and the Orders board.
// One tap moves an order to its next step. "ready → delivered" reads "Collected"
// for a pickup and "Delivered" for a delivery.
export const nextStep = (o) =>
  ({
    placed: { status: "baking", label: "Start baking" },
    baking: { status: "ready", label: "Mark ready" },
    ready: { status: "delivered", label: o.deliveryType === "delivery" ? "Delivered" : "Collected" }
  })[o.status];
