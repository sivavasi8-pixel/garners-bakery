// Ingredient stock levels, backed by PostgreSQL — see server/db/schema.sql.
const pool = require("../config/db");

const statusFor = (item) => {
  if (item.quantity <= 0) return "out_of_stock";
  if (item.quantity <= item.reorderLevel) return "low_stock";
  return "in_stock";
};

const mapRow = (row) =>
  row && {
    id: row.id,
    name: row.name,
    unit: row.unit,
    quantity: Number(row.quantity),
    reorderLevel: Number(row.reorder_level),
    supplier: row.supplier
  };

const withStatus = (item) => item && { ...item, status: statusFor(item) };

module.exports = {
  getAll: async () => {
    const { rows } = await pool.query("select * from inventory order by id");
    return rows.map(mapRow).map(withStatus);
  },
  getById: async (id) => {
    const { rows } = await pool.query("select * from inventory where id = $1", [Number(id)]);
    return withStatus(mapRow(rows[0]));
  },
  updateQuantity: async (id, quantity) => {
    const { rows } = await pool.query("update inventory set quantity = $1 where id = $2 returning *", [
      quantity,
      Number(id)
    ]);
    return withStatus(mapRow(rows[0]));
  },
  create: async ({ name, unit, quantity, reorderLevel, supplier }) => {
    const { rows } = await pool.query(
      `insert into inventory (name, unit, quantity, reorder_level, supplier)
       values ($1, $2, $3, $4, $5) returning *`,
      [name, unit, quantity || 0, reorderLevel || 0, supplier || null]
    );
    return withStatus(mapRow(rows[0]));
  },
  // Partial update — any omitted field keeps its current value, so this also covers
  // the old "just update the quantity" use case without a separate code path.
  update: async (id, { name, unit, quantity, reorderLevel, supplier }) => {
    const { rows } = await pool.query(
      `update inventory set
         name = coalesce($1, name),
         unit = coalesce($2, unit),
         quantity = coalesce($3, quantity),
         reorder_level = coalesce($4, reorder_level),
         supplier = coalesce($5, supplier)
       where id = $6 returning *`,
      [name ?? null, unit ?? null, quantity ?? null, reorderLevel ?? null, supplier ?? null, Number(id)]
    );
    return withStatus(mapRow(rows[0]));
  },
  // Cascades to recipe_ingredients (see schema.sql) — removing an ingredient in use
  // silently drops it from any recipe that referenced it.
  remove: async (id) => {
    const { rowCount } = await pool.query("delete from inventory where id = $1", [Number(id)]);
    return rowCount > 0;
  },
  // Relative decrement (vs. updateQuantity's absolute set) — used by recipe auto-deduct.
  // Floors at 0 rather than going negative; a recipe outpacing real stock shows as
  // "out of stock" rather than a confusing negative number.
  deduct: async (id, amount) => {
    const { rows } = await pool.query(
      "update inventory set quantity = greatest(quantity - $1, 0) where id = $2 returning *",
      [amount, Number(id)]
    );
    return withStatus(mapRow(rows[0]));
  },
  // Counterpart to deduct — used when an order is cancelled, to give back the stock
  // its recipe took. Not a perfect inverse (if the recipe changed since the order was
  // placed, this restocks at *today's* recipe, not the one used at order time), but
  // right for the common case and far better than stock never coming back at all.
  restock: async (id, amount) => {
    const { rows } = await pool.query("update inventory set quantity = quantity + $1 where id = $2 returning *", [
      amount,
      Number(id)
    ]);
    return withStatus(mapRow(rows[0]));
  }
};
