-- GARNERS Bakery — schema + seed data, mirroring the mock data in server/data/*.js
-- exactly, so switching to Postgres doesn't change what the app shows.
--
-- Run this once against your database: paste it into the Neon SQL Editor
-- (or `psql "$DATABASE_URL" -f server/db/schema.sql` if you have psql installed).

create table if not exists users (
  id serial primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('owner', 'staff', 'customer')),
  staff_id integer -- links a staff-role account to a row in staff.id, if any
);

create table if not exists staff (
  id serial primary key,
  name text not null,
  role text not null,
  shift text not null,
  status text not null default 'clocked_out'
);

create table if not exists staff_tasks (
  id serial primary key,
  description text not null,
  assigned_to text not null,
  due text not null,
  done boolean not null default false
);

create table if not exists menu_items (
  id serial primary key,
  name text not null,
  category text not null,
  price numeric, -- null means "made to order" (e.g. custom cakes)
  unit text not null,
  in_stock boolean not null default true,
  description text,
  image_data bytea, -- uploaded via the owner's Menu admin page, stored in the DB (not on disk)
  image_mime text,
  is_special boolean not null default false, -- "Today's Special" — see menuItems.js for how it auto-expires
  special_until timestamptz,
  is_popular boolean not null default false -- owner-curated "Popular" badge, no auto-expiry (unlike is_special)
);

-- Extra photos beyond the one on menu_items itself (which stays the "cover" image,
-- used everywhere a single thumbnail is needed). This table is purely additive —
-- an item with zero rows here just shows its cover image, same as before this existed.
create table if not exists menu_item_images (
  id serial primary key,
  menu_item_id integer not null references menu_items(id) on delete cascade,
  image_data bytea not null,
  image_mime text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_menu_item_images_menu_item_id on menu_item_images(menu_item_id);

create table if not exists inventory (
  id serial primary key,
  name text not null,
  unit text not null,
  quantity numeric not null default 0,
  reorder_level numeric not null default 0,
  supplier text
);

create table if not exists recipe_ingredients (
  id serial primary key,
  menu_item_id integer not null references menu_items(id) on delete cascade,
  inventory_id integer not null references inventory(id) on delete cascade,
  qty_per_unit numeric not null, -- how much of this ingredient one unit of the menu item uses
  unique (menu_item_id, inventory_id)
);

create table if not exists orders (
  id serial primary key,
  customer_name text not null,
  customer_id integer references users(id),
  items jsonb not null default '[]',
  total numeric not null default 0,
  pickup_time text,
  channel text not null default 'online',
  status text not null default 'placed' check (status in ('placed', 'baking', 'ready', 'delivered', 'cancelled')),
  payment_method text, -- 'cash' | 'upi' | 'card'
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id serial primary key,
  description text not null,
  amount numeric not null,
  category text not null default 'other', -- ingredients | utilities | rent | wages | other
  incurred_at date not null default current_date,
  created_by integer references users(id)
);

-- Seed data — same values as server/data/*.js

insert into staff (id, name, role, shift, status) values
  (1, 'Sara Menon', 'Baker', '6am–2pm', 'clocked_in'),
  (2, 'Ravi Joshi', 'Cashier', '9am–5pm', 'clocked_in'),
  (3, 'Neha Kulkarni', 'Decorator', '10am–6pm', 'on_break'),
  (4, 'Tara Pillai', 'Baker', '6am–2pm', 'clocked_in'),
  (5, 'Arjun Desai', 'Delivery', '11am–7pm', 'absent'),
  (6, 'Owner', 'Owner', 'flexible', 'clocked_in')
on conflict (id) do nothing;
select setval('staff_id_seq', (select max(id) from staff));

insert into staff_tasks (id, description, assigned_to, due, done) values
  (1, 'Bake 20 croissants', 'Sara Menon', '9:00 AM', false),
  (2, 'Decorate #1042 cake', 'Neha Kulkarni', '4:00 PM', false),
  (3, 'Restock display case', 'Ravi Joshi', 'done', true)
on conflict (id) do nothing;
select setval('staff_tasks_id_seq', (select max(id) from staff_tasks));

insert into menu_items (id, name, category, price, unit, in_stock, description) values
  (1, 'Sourdough loaf', 'breads', 220, 'loaf', true, 'Classic tangy crust, baked fresh daily'),
  (2, 'Butter croissant', 'pastries', 90, 'piece', true, 'Flaky, buttery layers'),
  (3, 'Eggless cookies', 'pastries', 180, 'box', true, 'Crumbly, oven fresh'),
  (4, 'Chocolate loaf cake', 'cakes', 350, 'loaf', true, 'Rich cocoa, baked in butter'),
  (5, 'Multigrain bread', 'breads', 240, 'loaf', true, 'Wholesome daily bake'),
  (6, 'Custom cake', 'custom', 1200, 'kg', true, 'Custom-decorated, priced per kg — pick size, flavor and a message below')
on conflict (id) do nothing;
select setval('menu_items_id_seq', (select max(id) from menu_items));

insert into inventory (id, name, unit, quantity, reorder_level, supplier) values
  (1, 'Vanilla essence', 'l', 0, 1, 'Sunrise Dairy Co.'),
  (2, 'Butter', 'kg', 2.1, 5, 'Sunrise Dairy Co.'),
  (3, 'Cocoa powder', 'kg', 1.4, 3, 'Golden Grain Mills'),
  (4, 'All-purpose flour', 'kg', 42, 10, 'Golden Grain Mills'),
  (5, 'Granulated sugar', 'kg', 27, 8, 'Golden Grain Mills')
on conflict (id) do nothing;
select setval('inventory_id_seq', (select max(id) from inventory));

-- Dev seed logins — same as server/data/users.js (owner123 / staff123 / customer123)
insert into users (id, name, email, password_hash, role, staff_id) values
  (1, 'Owner', 'owner@garners.test', '$2b$10$pgcAyiAuSRM4KbpoBv8nAOPuXd6OuSeh6RxyTildAq617qTDSsohy', 'owner', 6),
  (2, 'Sara Menon', 'sara@garners.test', '$2b$10$3Qg5wmC7R5xlgAcidQXf0eOdecde7DPXcKboV.jDE0wZk8zlIDEuC', 'staff', 1),
  (3, 'Priya S.', 'priya@example.com', '$2b$10$GLnAgD9I50Tp0laR2P0hkuRZ/NLJZQG0bbAkjiXSSx06Pr635xlzm', 'customer', null)
on conflict (id) do nothing;
select setval('users_id_seq', (select max(id) from users));

-- Rough bakery BOM — how much of each ingredient one unit of a menu item uses.
-- Drives auto-deduct on order creation (see server/controllers/orderController.js).
insert into recipe_ingredients (menu_item_id, inventory_id, qty_per_unit) values
  (1, 4, 0.5), (1, 5, 0.05),                 -- Sourdough loaf: flour, sugar
  (2, 2, 0.05), (2, 4, 0.1),                 -- Butter croissant: butter, flour
  (3, 2, 0.03), (3, 5, 0.05), (3, 4, 0.08),  -- Eggless cookies: butter, sugar, flour
  (4, 3, 0.05), (4, 2, 0.08), (4, 4, 0.15), (4, 5, 0.1), -- Chocolate loaf cake
  (5, 4, 0.45), (5, 5, 0.03),                -- Multigrain bread: flour, sugar
  (6, 2, 0.1), (6, 4, 0.2), (6, 5, 0.15), (6, 1, 0.01)   -- Custom cake (per kg)
on conflict (menu_item_id, inventory_id) do nothing;

insert into orders (id, customer_name, customer_id, items, total, pickup_time, channel, status, payment_method, payment_status, created_at) values
  (1040, 'Anita K.', null, '[{"name":"Sourdough loaf","qty":2}]', 440, 'Online delivery', 'online', 'placed', 'cash', 'paid', '2026-08-14T10:20:00Z'),
  (1041, 'Rahul M.', null, '[{"name":"Butter croissant","qty":6}]', 540, 'Walk-in', 'in-store', 'ready', 'cash', 'paid', '2026-08-14T10:02:00Z'),
  (1042, 'Priya S.', 3, '[{"name":"Custom cake, 2kg","qty":1}]', 2400, '5:00 PM', 'online', 'baking', 'upi', 'paid', '2026-08-14T09:15:00Z')
on conflict (id) do nothing;
select setval('orders_id_seq', 1043);
