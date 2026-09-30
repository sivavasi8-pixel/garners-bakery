// The three real delivery zones Garners Cakes uses today (from the delivery-charges
// poster shared over WhatsApp). Mirrored in client/src/deliveryZones.js for the
// checkout UI — kept as plain data in both places since there's no shared package
// between server and client in this repo.
const ZONES = {
  ramagondanahalli: {
    id: "ramagondanahalli",
    label: "Ramagondanahalli / Borewell Road",
    minOrder: 0,
    feeType: "free"
  },
  whitefield: {
    id: "whitefield",
    label: "Within Whitefield (4km radius)",
    minOrder: 250,
    feeType: "tiered",
    feeUnderThreshold: 30,
    freeAboveThreshold: 500
  },
  outside: {
    id: "outside",
    label: "Outside Whitefield (beyond 4km)",
    minOrder: 250,
    feeType: "porter" // no public API for Porter's live rate — fee is confirmed manually by staff
  }
};

// Returns { fee, pending } — fee is null and pending is true for the Porter zone,
// meaning staff must call/message the customer with the actual charge before baking starts.
const calculateFee = (zoneId, itemsTotal) => {
  const zone = ZONES[zoneId];
  if (!zone) return { fee: null, pending: false };
  if (zone.feeType === "free") return { fee: 0, pending: false };
  if (zone.feeType === "porter") return { fee: null, pending: true };
  // tiered
  const fee = itemsTotal >= zone.freeAboveThreshold ? 0 : zone.feeUnderThreshold;
  return { fee, pending: false };
};

module.exports = { ZONES, calculateFee };
