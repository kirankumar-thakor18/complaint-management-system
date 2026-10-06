// ===== AUTH MIDDLEWARE (JWT) =====
//
// Stateless Bearer-token auth. Tokens are signed JWTs, so they survive
// server restarts (unlike the old in-memory token map) and need no server
// side session storage.

const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const EXPIRES_IN = "7d";

if (!process.env.JWT_SECRET) {
  console.warn("[auth] JWT_SECRET is not set — using an insecure dev default. Set it in .env for production.");
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

// Extracts and verifies the Bearer token, sets req.userId. No DB access
// here — the route handler wrapper loads the user inside the request's
// DB transaction so role/existence checks always see fresh data.
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { signToken, verifyToken, authMiddleware };
