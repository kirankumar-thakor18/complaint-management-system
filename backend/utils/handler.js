// ===== ROUTE HANDLER WRAPPER =====
//
// handle(handler, options) wires up a route so that:
//   - the Bearer token is verified (unless auth: false),
//   - the request runs inside a serialized DB transaction (db.js withDB)
//     with the authenticated user freshly loaded (so role checks can't go
//     stale and concurrent requests can't lose updates),
//   - unexpected errors become a 500 JSON response.
//
// Options:
//   auth: false   -> public route, no token required
//   admin: true   -> reject non-admin users with 403
//   readOnly: true -> do not persist the db after the handler (pure reads)

const { withDB, withRead } = require("../db");
const { authMiddleware } = require("../middleware/auth");

function loadAuthenticatedUser(db, req, res, admin) {
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) {
    res.status(401).json({ error: "User no longer exists" });
    return null;
  }
  if (admin && user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  req.user = user;
  return user;
}

function handle(handler, { auth = true, admin = false, readOnly = false } = {}) {
  return (req, res) => {
    const run = async () => {
      const execute = async (db) => {
        if (auth && !loadAuthenticatedUser(db, req, res, admin)) return;
        req.db = db;
        await handler(req, res);
      };

      if (readOnly) {
        await withRead(execute);
      } else {
        await withDB(execute);
      }
    };

    const finish = (work) =>
      work.catch((err) => {
        console.error("Request error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Server error" });
      });

    if (auth) {
      authMiddleware(req, res, () => finish(run()));
    } else {
      finish(run());
    }
  };
}

module.exports = { handle };
