// The shop's own coordinates, used to compute "X km away" on the delivery
// dashboard. Reads the owner-configured value from Settings first; falls back
// to an approximate, neighborhood-level default only until that's been set.
const settings = require("../data/settings");

// Fallback — geocoded from "Ramagondanahalli / Borewell Road, Whitefield" at
// launch, not an exact shop pin. Once the owner sets a precise location from
// the Settings page (ideally via "Use my current location" while physically
// at the shop), that value takes over everywhere this is used.
const DEFAULT_LAT = 12.9558969;
const DEFAULT_LNG = 77.7405826;

async function getStoreLocation() {
  const all = await settings.getAll();
  const lat = all.shopLat ? Number(all.shopLat) : null;
  const lng = all.shopLng ? Number(all.shopLng) : null;
  return {
    lat: Number.isFinite(lat) ? lat : DEFAULT_LAT,
    lng: Number.isFinite(lng) ? lng : DEFAULT_LNG
  };
}

module.exports = { getStoreLocation };
