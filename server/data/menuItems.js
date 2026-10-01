// Menu items, backed by PostgreSQL — see server/db/schema.sql.
// Uploaded photos are stored as bytea in the same row (image_data/image_mime),
// not on local disk, so they persist the same way the rest of the data does.
const pool = require("../config/db");

// "special" is a menu category like any other, except it's deliberately left out
// of the customer-facing category tabs (Breads/Cookies/Cakes/Custom) — it only
// ever shows in the Today's Specials strip. See Order.jsx / MenuAdmin.jsx.
const SPECIAL_CATEGORY = "special";

// Extra photos per item are capped — this is a small bakery menu, not a stock
// photo library, and it keeps the gallery UI (and upload requests) bounded.
const MAX_GALLERY_IMAGES = 4;

// live-computed, not trusted from the stored flag alone — a "special" from
// yesterday that nobody manually cleared should stop counting on its own,
// without needing a cron job to flip the boolean at midnight.
const isCurrentlySpecial = (row) =>
  row.is_special && (!row.special_until || new Date(row.special_until) > new Date());

// `has_image` is only present on rows from SELECT_WITH_GALLERY (which deliberately
// never selects the bytea); a raw INSERT/UPDATE ... RETURNING * row (from create())
// still carries image_data itself, so fall back to checking that directly.
const mapRow = (row) =>
  row && {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price === null ? null : Number(row.price),
    unit: row.unit,
    inStock: row.in_stock,
    description: row.description,
    imageUrl: (row.has_image !== undefined ? row.has_image : Boolean(row.image_data)) ? `/api/menu/${row.id}/image` : null,
    isSpecial: isCurrentlySpecial(row),
    specialUntil: row.special_until,
    isPopular: row.is_popular,
    // Extra gallery photos, in order — cover image (imageUrl above) is separate
    // and always shown first by the client; this is purely the "more photos" set.
    galleryImages: (row.gallery || []).map((g) => `/api/menu/${row.id}/images/${g.id}`)
  };

// Every row-returning query needs the same gallery aggregation, so it lives once here.
// Deliberately never selects image_data/image_mime (each photo can be up to 5MB) —
// every menu load was downloading every item's full photo just to render a list;
// has_image is enough to know whether to request the dedicated image endpoint.
const SELECT_WITH_GALLERY = `
  select m.id, m.name, m.category, m.price, m.unit, m.in_stock, m.description,
    (m.image_data is not null) as has_image, m.is_special, m.special_until, m.is_popular,
    coalesce(
      json_agg(json_build_object('id', gi.id) order by gi.sort_order, gi.id)
        filter (where gi.id is not null),
      '[]'
    ) as gallery
  from menu_items m
  left join menu_item_images gi on gi.menu_item_id = m.id
`;

module.exports = {
  MAX_GALLERY_IMAGES,

  getAll: async () => {
    const { rows } = await pool.query(`${SELECT_WITH_GALLERY} group by m.id order by m.id`);
    return rows.map(mapRow);
  },
  getById: async (id) => {
    const { rows } = await pool.query(`${SELECT_WITH_GALLERY} where m.id = $1 group by m.id`, [Number(id)]);
    return mapRow(rows[0]);
  },
  getByCategory: async (category) => {
    const { rows } = await pool.query(
      `${SELECT_WITH_GALLERY} where m.category = $1 group by m.id order by m.id`,
      [category]
    );
    return rows.map(mapRow);
  },
  // Lean lookup used by order creation to price items server-side — the prices a
  // browser sends are never trusted, only the ids.
  getForPricing: async (ids, db = pool) => {
    const { rows } = await db.query(
      "select id, name, category, price, unit, in_stock from menu_items where id = any($1::int[])",
      [ids.map(Number)]
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      price: r.price === null ? null : Number(r.price),
      unit: r.unit,
      inStock: r.in_stock
    }));
  },
  getImage: async (id) => {
    const { rows } = await pool.query("select image_data, image_mime from menu_items where id = $1", [Number(id)]);
    const row = rows[0];
    if (!row || !row.image_data) return null;
    return { data: row.image_data, mime: row.image_mime };
  },
  create: async ({ name, category, price, unit, description, image }) => {
    // A brand-new "special"-category dish is, by definition, today's special the
    // moment it's created — no separate toggle step needed right after adding it.
    const isSpecialCategory = category === SPECIAL_CATEGORY;
    const { rows } = await pool.query(
      `insert into menu_items (name, category, price, unit, description, image_data, image_mime, is_special, special_until)
       values ($1, $2, $3, $4, $5, $6, $7, $8,
         case when $8 then date_trunc('day', now()) + interval '1 day' - interval '1 second' else null end)
       returning *`,
      [name, category, price ?? null, unit, description ?? null, image?.data ?? null, image?.mime ?? null, isSpecialCategory]
    );
    return mapRow({ ...rows[0], gallery: [] });
  },
  update: async (id, { name, category, price, unit, description, image }) => {
    // Only overwrite the image if a new one was uploaded — a plain field edit shouldn't wipe the photo.
    const { rows } = await pool.query(
      `update menu_items set
         name = $1, category = $2, price = $3, unit = $4, description = $5,
         image_data = coalesce($6, image_data), image_mime = coalesce($7, image_mime)
       where id = $8 returning *`,
      [name, category, price ?? null, unit, description ?? null, image?.data ?? null, image?.mime ?? null, Number(id)]
    );
    if (!rows[0]) return null;
    return module.exports.getById(id);
  },
  remove: async (id) => {
    const { rowCount } = await pool.query("delete from menu_items where id = $1", [Number(id)]);
    return rowCount > 0;
  },
  setInStock: async (id, inStock) => {
    const { rows } = await pool.query("update menu_items set in_stock = $1 where id = $2 returning *", [
      inStock,
      Number(id)
    ]);
    if (!rows[0]) return null;
    return module.exports.getById(id);
  },
  // Flips "today's special" on (expiring end of today, server clock) or off.
  setSpecial: async (id, isSpecial) => {
    const { rows } = await pool.query(
      `update menu_items set
         is_special = $1,
         special_until = case when $1 then date_trunc('day', now()) + interval '1 day' - interval '1 second' else null end
       where id = $2 returning *`,
      [isSpecial, Number(id)]
    );
    if (!rows[0]) return null;
    return module.exports.getById(id);
  },
  // Owner-curated "bestseller" badge — no expiry, no auto-computation from order
  // history (that data lives behind the owner-only Reports endpoint and isn't
  // safe to expose to customers), just a manual flag mirroring is_special.
  setPopular: async (id, isPopular) => {
    const { rows } = await pool.query("update menu_items set is_popular = $1 where id = $2 returning *", [
      isPopular,
      Number(id)
    ]);
    if (!rows[0]) return null;
    return module.exports.getById(id);
  },

  // --- gallery images (extra photos beyond the cover image) ---
  getGalleryImage: async (menuItemId, imageId) => {
    const { rows } = await pool.query(
      "select image_data, image_mime from menu_item_images where id = $1 and menu_item_id = $2",
      [Number(imageId), Number(menuItemId)]
    );
    const row = rows[0];
    if (!row) return null;
    return { data: row.image_data, mime: row.image_mime };
  },
  addGalleryImage: async (menuItemId, { data, mime }) => {
    const { rows: countRows } = await pool.query(
      "select count(*)::int as count, coalesce(max(sort_order), -1) as max_sort from menu_item_images where menu_item_id = $1",
      [Number(menuItemId)]
    );
    if (countRows[0].count >= MAX_GALLERY_IMAGES) {
      const err = new Error(`This item already has the maximum of ${MAX_GALLERY_IMAGES} extra photos`);
      err.status = 400;
      throw err;
    }
    await pool.query(
      "insert into menu_item_images (menu_item_id, image_data, image_mime, sort_order) values ($1, $2, $3, $4)",
      [Number(menuItemId), data, mime, countRows[0].max_sort + 1]
    );
    return module.exports.getById(menuItemId);
  },
  removeGalleryImage: async (menuItemId, imageId) => {
    const { rowCount } = await pool.query(
      "delete from menu_item_images where id = $1 and menu_item_id = $2",
      [Number(imageId), Number(menuItemId)]
    );
    if (rowCount === 0) return null;
    return module.exports.getById(menuItemId);
  }
};
