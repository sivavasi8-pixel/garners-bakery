// Opening hours and pickup/delivery slots. Shown on the checkout screen (sent by
// GET /api/orders/store-status) and enforced when an order is placed, so this file
// is the one place to change them.
//
// Shop hours 9:00 AM – 8:00 PM, every 30 minutes (the same hours the earlier
// checkout dropdown used). Times are 24-hour "HH:MM" in India time.
const SLOTS = [];
for (let h = 9; h <= 20; h++) {
  for (const m of [0, 30]) {
    if (h === 20 && m === 30) break; // closes 8:00 PM
    SLOTS.push(`${String(h).padStart(2, "0")}:${m ? "30" : "00"}`);
  }
}

// How far ahead customers can book, and the notice a slot needs on the same day.
const BOOKING_DAYS_AHEAD = 6;
const SAME_DAY_NOTICE_MINUTES = 45;
// Custom cakes are baked to order, so they need at least this many days' notice.
const CUSTOM_CAKE_LEAD_DAYS = 1;

const TZ = "Asia/Kolkata";
const DAY_MS = 24 * 60 * 60 * 1000;

// YYYY-MM-DD for a moment, in India time.
const istDate = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ });
// Minutes since midnight, in India time.
const istMinutes = (ms) => {
  const [h, m] = new Date(ms)
    .toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
};
// Weekday of a YYYY-MM-DD calendar date (0 = Sunday). Noon UTC keeps it on the same date.
const weekdayOf = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
const isMonday = (ymd) => weekdayOf(ymd) === 1;
const slotMinutes = (slot) => {
  const [h, m] = slot.split(":").map(Number);
  return h * 60 + m;
};

// "4:00 PM"
const slotLabel = (slot) => {
  const mins = slotMinutes(slot);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
// "Thu 1 Oct"
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateLabel = (ymd) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${WEEKDAYS[weekdayOf(ymd)]} ${d} ${MONTHS[m - 1]}`;
};

// The next bookable days (closed Mondays marked), each with the slots still open.
const upcomingDays = (now = Date.now()) => {
  const today = istDate(now);
  const nowMins = istMinutes(now);
  const days = [];
  for (let i = 0; i <= BOOKING_DAYS_AHEAD; i++) {
    const date = istDate(now + i * DAY_MS);
    const closed = isMonday(date);
    const slots = closed
      ? []
      : SLOTS.filter((s) => date !== today || slotMinutes(s) >= nowMins + SAME_DAY_NOTICE_MINUTES).map((s) => ({
          value: s,
          label: slotLabel(s)
        }));
    days.push({ date, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : dateLabel(date), closed, slots });
  }
  return days;
};

// Throws a message (string) when the choice isn't bookable; returns the display text otherwise.
const validateSlot = ({ date, slot, hasCustomCake, deliveryType }, now = Date.now()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !SLOTS.includes(slot)) {
    return { error: "Choose a day and time for your order" };
  }
  const day = upcomingDays(now).find((d) => d.date === date);
  if (!day) return { error: `Orders can be booked up to ${BOOKING_DAYS_AHEAD} days ahead` };
  if (day.closed) return { error: "We're closed on Mondays — please pick another day" };
  if (!day.slots.some((s) => s.value === slot)) return { error: "That time has passed — please pick a later slot" };
  if (hasCustomCake) {
    const earliest = istDate(now + CUSTOM_CAKE_LEAD_DAYS * DAY_MS);
    if (date < earliest) return { error: "Custom cakes need at least a day's notice — please pick a later day" };
  }
  // Delivery is only available 3:00 PM – 6:00 PM.
  if (deliveryType === "delivery") {
    const mins = slotMinutes(slot);
    if (mins < 15 * 60 || mins > 18 * 60) {
      return { error: "Delivery is only available between 3:00 PM and 6:00 PM — please pick a time in that window" };
    }
  }
  return { text: `${dateLabel(date)}, ${slotLabel(slot)}` };
};

module.exports = { SLOTS, upcomingDays, validateSlot, CUSTOM_CAKE_LEAD_DAYS };
