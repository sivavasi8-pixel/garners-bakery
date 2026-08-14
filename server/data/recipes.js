// The bakery's ingredient BOM per menu item — drives inventory auto-deduct on order
// creation, and is editable from the Menu admin page's recipe editor.
const pool = require("../config/db");

module.exports = {
  // Lean shape (inventoryId + qty only) — used by orderController's deduction loop.
  getForMenuItem: async (menuItemId) => {
    const { rows } = await pool.query(
      "select inventory_id, qty_per_unit from recipe_ingredients where menu_item_id = $1",
      [Number(menuItemId)]
    );
    return rows.map((r) => ({ inventoryId: r.inventory_id, qtyPerUnit: Number(r.qty_per_unit) }));
  },
  // Display shape (joined with ingredient name/unit) — used by the recipe editor UI.
  getForMenuItemDetailed: async (menuItemId) => {
    const { rows } = await pool.query(
      `select ri.id, ri.inventory_id, ri.qty_per_unit, i.name, i.unit
       from recipe_ingredients ri
       join inventory i on i.id = ri.inventory_id
       where ri.menu_item_id = $1
       order by i.name`,
      [Number(menuItemId)]
    );
    return rows.map((r) => ({
      id: r.id,
      inventoryId: r.inventory_id,
      qtyPerUnit: Number(r.qty_per_unit),
      name: r.name,
      unit: r.unit
    }));
  },
  // Replace-all: simplest contract for a form that submits the whole ingredient list at
  // once, rather than incremental add/remove endpoints. Transactional so a failure
  // partway through (e.g. a bad inventoryId) leaves the old recipe intact, not half-written.
  setForMenuItem: async (menuItemId, ingredients) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from recipe_ingredients where menu_item_id = $1", [Number(menuItemId)]);
      for (const ing of ingredients) {
        if (!ing.inventoryId || !ing.qtyPerUnit) continue;
        await client.query(
          "insert into recipe_ingredients (menu_item_id, inventory_id, qty_per_unit) values ($1, $2, $3)",
          [Number(menuItemId), Number(ing.inventoryId), Number(ing.qtyPerUnit)]
        );
      }
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
    return module.exports.getForMenuItemDetailed(menuItemId);
  }
};
