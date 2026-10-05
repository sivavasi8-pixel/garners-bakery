// Devices registered for push notifications, backed by PostgreSQL. One row
// per (user, device) — a user logged in on two phones gets two rows.
const pool = require("../config/db");

module.exports = {
  register: async (userId, token) => {
    await pool.query(
      `insert into push_tokens (user_id, token) values ($1, $2)
       on conflict (token) do update set user_id = excluded.user_id`,
      [Number(userId), token]
    );
  },

  // Called when someone taps "turn off" — removes just this device's token,
  // not every token this user has registered.
  unregister: async (token) => {
    await pool.query("delete from push_tokens where token = $1", [token]);
  },

  // FCM reports a token as dead (app uninstalled, permission revoked) —
  // push.js calls this to stop retrying it.
  removeTokens: async (tokens) => {
    if (!tokens || tokens.length === 0) return;
    await pool.query("delete from push_tokens where token = any($1)", [tokens]);
  },

  getTokensForUsers: async (userIds) => {
    if (!userIds || userIds.length === 0) return [];
    const { rows } = await pool.query("select token from push_tokens where user_id = any($1)", [userIds]);
    return rows.map((r) => r.token);
  },

  getTokensForRoles: async (roles) => {
    const { rows } = await pool.query(
      `select pt.token from push_tokens pt
       join users u on u.id = pt.user_id
       where u.role = any($1)`,
      [roles]
    );
    return rows.map((r) => r.token);
  },

  getTokensForRolesExcludingUser: async (roles, excludeUserId) => {
    const { rows } = await pool.query(
      `select pt.token from push_tokens pt
       join users u on u.id = pt.user_id
       where u.role = any($1) and u.id != $2`,
      [roles, Number(excludeUserId)]
    );
    return rows.map((r) => r.token);
  }
};
