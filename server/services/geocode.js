// OpenStreetMap Nominatim — free, no API key, but rate-limited and requires an
// identifying User-Agent (its usage policy), which only a server-side request
// can set. Every function here is best-effort: a slow network or an address
// Nominatim can't find must never break checkout or the address book, so every
// failure (including a timeout) just resolves to null rather than throwing.
const USER_AGENT = "GarnersBakery/1.0 (contact: owner@garners.test)";

exports.reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      headers: { "User-Agent": USER_AGENT }
    });
    const data = await res.json();
    return data && data.display_name ? data.display_name : null;
  } catch {
    return null;
  }
};

// Address text -> coordinates, for an address typed by hand (no GPS capture) —
// lets distance-from-store still work for the common case. Capped at a short
// timeout so a slow Nominatim response can't noticeably delay checkout.
exports.forwardGeocode = async (address, { timeoutMs = 4000 } = {}) => {
  if (!address) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { "User-Agent": USER_AGENT }, signal: controller.signal }
    );
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
