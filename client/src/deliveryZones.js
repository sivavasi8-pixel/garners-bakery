// Mirrors server/data/deliveryZones.js — kept in sync manually (no shared package
// between client and server in this repo). Used for checkout display; the server
// is the source of truth for the actual fee charged.
export const ZONES = [
  {
    id: "ramagondanahalli",
    label: "Ramagondanahalli / Borewell Road",
    minOrder: 0,
    feeType: "free"
  },
  {
    id: "whitefield",
    label: "Within Whitefield (4km radius)",
    minOrder: 250,
    feeType: "tiered",
    feeUnderThreshold: 30,
    freeAboveThreshold: 500
  },
  {
    id: "outside",
    label: "Outside Whitefield (beyond 4km)",
    minOrder: 250,
    feeType: "porter"
  }
];

// Mirrors server/data/deliveryZones.js's calculateFee — used for display before checkout;
// the server recomputes and enforces this itself rather than trusting the client's number.
export function calculateFee(zoneId, itemsTotal) {
  const zone = ZONES.find((z) => z.id === zoneId);
  if (!zone) return { fee: null, pending: false };
  if (zone.feeType === "free") return { fee: 0, pending: false };
  if (zone.feeType === "porter") return { fee: null, pending: true };
  const fee = itemsTotal >= zone.freeAboveThreshold ? 0 : zone.feeUnderThreshold;
  return { fee, pending: false };
}
