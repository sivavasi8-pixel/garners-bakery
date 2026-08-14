# GARNERS Bakery — shop management platform

Full-stack app for GARNERS Cakes & Breads: owner dashboard, staff management
(add/remove roster + optional logins, task edit/delete), inventory tracking
(add/edit/remove ingredients, recipe-based auto-deduct, a recipe editor,
sold-out toggling), a full order lifecycle (search/filter, status, payment,
cancellation with automatic inventory restock) with an in-store POS and
printable receipts, expense/profit reporting, live in-app notifications, and
a customer ordering flow (including a real custom cake order form).

Backed by a real **PostgreSQL** database (a free Neon instance) — see
`server/data/*.js` for the query layer and `server/db/schema.sql` for the
schema. Without a `DATABASE_URL` set, the same `data/*.js` shape falls back
to nothing (the app expects a real DB now); see "Connecting a real
PostgreSQL database" below if you're setting this up fresh elsewhere.

## Project structure

```
garners-bakery/
  server/           Express API
    routes/         URL → controller mapping
    controllers/     Request handling
    data/           PostgreSQL queries (was in-memory mock data, now real)
    db/schema.sql   Table definitions + seed data
    config/db.js    PostgreSQL connection pool
  client/           React app (Vite)
    src/pages/      Dashboard, Inventory, Staff, POS, Orders, Order,
                    MyOrders, MenuAdmin, Reports, Receipt, Login, Signup
    src/components/ Shared UI (nav, cards, badges, notification bell)
    src/auth/       Auth context + protected-route wrapper
    src/api.js      Fetch helper for the backend
```

## Running locally

You'll need Node.js 18+ installed.

**1. Start the backend**
```
cd server
npm install
npm run dev
```
Runs on http://localhost:4000 — try http://localhost:4000/api/health

**2. Start the frontend** (in a new terminal)
```
cd client
npm install
npm run dev
```
Runs on http://localhost:5173 and proxies `/api` calls to the backend.

## Authentication

Every route except `/api/menu` and `/api/auth/*` requires a `Bearer <token>` from
`/api/auth/login`. Roles: `owner`, `staff` (both can see the dashboard/inventory/staff
pages), and `customer` (can place orders). Tokens are JWTs signed with `JWT_SECRET`
(falls back to a dev-only secret if unset) and expire after 7 days.

There's no self-serve owner/staff signup — those accounts are seeded in
`server/data/users.js`. Customers can self-register via `/api/auth/signup`.

**Seeded dev logins:**

| Role | Email | Password |
|---|---|---|
| Owner | owner@garners.test | owner123 |
| Staff | sara@garners.test | staff123 |
| Customer | priya@example.com | customer123 |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/login | none | Log in, returns `{ token, user }` |
| POST | /api/auth/signup | none | Register a new customer account |
| GET | /api/auth/me | any | Current logged-in user |
| GET | /api/dashboard/summary | owner/staff | Owner dashboard stats (today's revenue/orders) |
| GET | /api/reports/summary | owner | Last-7-days revenue, best sellers, all-time totals |
| GET | /api/menu | none | List menu items (optional `?category=`) |
| GET | /api/menu/:id/image | none | Serves an item's uploaded photo (stored as bytea) |
| POST | /api/menu | owner | Add a menu item (`multipart/form-data`, optional `image` file) |
| PATCH | /api/menu/:id | owner | Edit a menu item / replace its photo |
| DELETE | /api/menu/:id | owner | Remove a menu item |
| PATCH | /api/menu/:id/availability | owner/staff | Toggle sold-out (`{ inStock }`) |
| GET | /api/menu/:id/recipe | owner | This item's ingredient BOM (joined with ingredient name/unit) |
| PUT | /api/menu/:id/recipe | owner | Replace the whole recipe (`{ ingredients: [{inventoryId, qtyPerUnit}] }`) |
| GET | /api/orders | owner/staff | List orders (optional `?status=`) |
| GET | /api/orders/mine | customer | The logged-in customer's own order history |
| GET | /api/orders/:id | any | Single order (customer: only their own — powers the receipt page) |
| POST | /api/orders | owner/staff/customer | Create an order (online checkout or in-store POS) |
| PATCH | /api/orders/:id/status | owner/staff | Update order status |
| PATCH | /api/orders/:id/payment | owner/staff | Mark an order paid/unpaid |
| PATCH | /api/orders/:id/pickup-time | owner/staff | Edit an order's pickup time |
| PATCH | /api/orders/:id/cancel | any | Cancel (customer: only own, only while `placed`); restocks inventory |
| GET | /api/inventory | owner/staff | List ingredients + stock levels |
| POST | /api/inventory | owner | Add a new ingredient |
| PATCH | /api/inventory/:id | owner/staff | Update any subset of fields (quantity-only PATCH still works) |
| DELETE | /api/inventory/:id | owner | Remove an ingredient (cascades: drops it from any recipe using it) |
| GET | /api/staff | owner/staff | List staff + shift status |
| POST | /api/staff | owner | Add a roster entry, optionally with a login (`email`+`password`) |
| DELETE | /api/staff/:id | owner | Remove a roster entry (cascades: also deletes their login, if any) |
| PATCH | /api/staff/:id/status | owner/staff | Clock in/out, break, absent |
| PATCH | /api/staff/:id/shift | owner | Edit a staff member's shift |
| GET | /api/staff/tasks | owner/staff | List task assignments |
| POST | /api/staff/tasks | owner/staff | Create a task |
| PATCH | /api/staff/tasks/:id | owner/staff | Edit any subset of fields, including `done` |
| DELETE | /api/staff/tasks/:id | owner/staff | Remove a task |
| GET | /api/notifications | any | Live alerts (role-specific — see below) |
| GET | /api/reports/summary | owner | Also includes expenses + profit now (see below) |
| GET | /api/expenses | owner | List logged expenses |
| POST | /api/expenses | owner | Log an expense |
| DELETE | /api/expenses/:id | owner | Remove an expense |

### In-store POS & recipe-based inventory

`POST /api/orders` now accepts `owner`/`staff` too, not just `customer` — the
**POS** page (`/pos`) uses it to ring up walk-in sales (`customerName` in the
body, no account needed). Whichever role places an order, if its items carry
a `menuItemId`, `server/controllers/orderController.js` looks up
`recipe_ingredients` (the bakery's BOM) and auto-deducts the matching
ingredient quantities from `inventory`, floored at zero.

### Managing staff, inventory, and recipes

These all used to be view-only (or database-only) — now:

- **Staff** (`/staff`, owner-only controls): "Add a staff member" creates a
  roster row and, optionally, a login (email + password) in the same form —
  a roster entry doesn't require app access. Removing a staff member also
  deletes their login if they had one (`server/data/staff.js`'s `remove`).
- **Inventory** (`/inventory`): owner/staff can update a quantity inline
  (quick restock); owner additionally gets full add/edit/delete for
  ingredients. Deleting an ingredient cascades — it's silently dropped from
  any recipe that referenced it (see the `on delete cascade` on
  `recipe_ingredients` in `schema.sql`).
- **Recipes**: click "Recipe" on a menu item in `/menu-admin` to open an
  inline editor — add/remove ingredient rows, set qty-per-unit, save. It's a
  replace-all PUT (`recipes.setForMenuItem`), wrapped in a DB transaction so
  a bad row can't leave the recipe half-written.
- **Sold-out toggling**: owner/staff can mark any menu item unavailable —
  from the Menu admin page or right on a POS tile. Customers see "Sold out"
  instead of an Add button; POS disables the tap-to-add but still lets staff
  flip it back.

### Order lifecycle: search, status, cancellation

- **`/orders`** (owner/staff) is the full order list — search by customer
  name or order #, filter by status, advance status (placed → baking →
  ready → delivered), mark paid, edit pickup time, or cancel — all from one
  screen. The Dashboard's "Order queue" only shows the 5 most recent; this
  is everything.
- **Cancellation** (`PATCH /api/orders/:id/cancel`) is available to a
  customer only for their own order and only while it's still `placed`
  (once baking starts, they're told to contact the shop); owner/staff can
  cancel anything short of `delivered`. Cancelling **restocks inventory** —
  it reverses the same recipe-based deduction that happened at order time
  (`orderController.js`'s `adjustStockForItems`, shared by both directions).
  This isn't a perfect inverse if a recipe changed between order and
  cancellation (it restocks at *today's* recipe), but it's right for the
  common case and far better than stock never coming back.

### Notifications

`GET /api/notifications` is computed fresh on every request (no persisted
log, so no read/unread state) — owner/staff get pending orders + low stock,
a customer gets their own active order statuses. The bell in the header
polls it every 30s. This is in-app only, not push notifications (no service
worker/OS alerts) — out of scope for a local dev app without a deploy target.

### Reports export

The Reports page has "Export CSV" (plain client-side Blob download, opens in
Excel) and "Print / Save as PDF" (uses the browser's native print dialog,
with a `@media print` rule in `theme.css` hiding the nav — no PDF library
needed).

### Payments & receipts

Every order now carries `paymentMethod` (`cash`/`upi`/`card`) and
`paymentStatus` (`unpaid`/`paid`). There's no real payment gateway (out of
scope for a local dev app), so it's simulated: a POS sale is always marked
paid immediately (charged at the counter); an online order is paid
immediately for `upi`/`card` (treated as prepaid) but stays `unpaid` for
`cash` (pay on pickup) until owner/staff hits "Mark paid" on the Dashboard.
`/receipt/:id` is a printable receipt for any order — a customer can only
open their own (enforced server-side in `orderController.getOrder`),
owner/staff can open any.

### Custom cakes

The "Custom order" tab on the Order page is a real form now (size, flavor,
message, needed-by date), priced off the `Custom cake` menu item's per-kg
price. The cake message/date get stored as free text in the order's `items`
JSON (`note` field) — shown wherever order items are listed.

### Expenses & profit

Owner-only. Logged on the Reports page (description, amount, category,
dated to today by default). `reports/summary` now returns
`allTimeExpenses`/`allTimeProfit` and the same for the last 7 days —
profit is revenue minus logged expenses, not strict cash-basis accounting
(revenue counts every order's total the same way the dashboard already
does, regardless of `paymentStatus`).

## Connecting a real PostgreSQL database

This is already set up for local dev (a `server/.env` with a Neon
`DATABASE_URL` — gitignored, not in the repo). If you're setting this app up
somewhere fresh and need to (re)connect a database:

1. **Get a free Postgres database** — [neon.tech](https://neon.tech) works well
   (no card required). Sign up, create a project, and copy the connection
   string it gives you (looks like `postgresql://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require`).
2. **Create the tables**: paste the contents of `server/db/schema.sql` into
   Neon's SQL Editor (or run it with `psql` if you have it installed) — this
   creates all the tables and seeds them with the same data currently in
   `server/data/*.js`, so nothing changes visually when you switch over.
3. **Add your connection string**: copy `server/.env.example` to
   `server/.env` and fill in `DATABASE_URL` (and optionally `JWT_SECRET`,
   otherwise a dev default is used).
4. Restart the server (`npm run dev`) — the startup log will say
   `(PostgreSQL)` instead of `(mock in-memory data)` once it's connected.

`server/config/db.js` exports the connection pool (or `null` if
`DATABASE_URL` isn't set — the app will error on any data-layer call in that
case, since `server/data/*.js` now query Postgres directly rather than
falling back to in-memory arrays).

## Design

See `DESIGN.md` for the brand palette and design tokens, drawn from
GARNERS' real storefront and packaging (forest green, kraft paper, red
awning stripe, teal interior wall) rather than a generic bakery theme.
