const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

/**
 * Middleware: verify JWT and attach user to req.
 * In demo mode (no auth header), attaches a mock user.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    // Demo mode — attach mock user
    req.user = { id: "demo-user", email: "student@example.com" };
    return next();
  }

  try {
    const token = header.replace("Bearer ", "");
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
