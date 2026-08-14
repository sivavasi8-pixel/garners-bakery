// Wraps an async route handler so a rejected promise (e.g. a failed DB query)
// reaches Express's error handler instead of crashing the process unhandled.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
