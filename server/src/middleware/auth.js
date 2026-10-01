const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ──────────────────────────────────────────────
// Role hierarchy (higher rank = more privileges)
// ──────────────────────────────────────────────
const ROLE_HIERARCHY = {
  super_admin: 5,
  admin: 4,
  manager: 3,
  developer: 2,
  employee: 1,
};

const ALL_ROLES = Object.keys(ROLE_HIERARCHY);

/**
 * Middleware: authenticateUser — Verify JWT and retrieve role from DB.
 * NEVER trusts the role in the JWT payload as the source of truth.
 * Always fetches the current role from the database.
 * Attaches full user info to req.user.
 */
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ═══ CRITICAL: Always fetch role from database, not JWT ═══
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "User account not found." });
    }

    // Check if account is active
    if (user.status === "suspended") {
      return res.status(403).json({ message: "Your account has been suspended." });
    }
    if (user.status === "inactive") {
      return res.status(403).json({ message: "Your account is inactive." });
    }

    // Attach DB-verified user info to request
    // SECURITY: The role comes from the DATABASE, never from JWT or request body
    req.user = {
      userId: user._id.toString(),
      role: user.role, // From DATABASE, not JWT
      username: user.username,
      teamId: user.teamId,
      name: user.name,
      email: user.email,
      status: user.status,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token has expired." });
    }
    return res.status(401).json({ message: "Invalid token." });
  }
};

/**
 * Middleware: verifyToken — Lightweight JWT verification (backward compat).
 * Uses DB-verified role via authenticateUser.
 */
const verifyToken = authenticateUser;

/**
 * Middleware factory: authorizeRole — Restrict access to specific roles.
 * Usage: authorizeRole("admin", "super_admin")
 */
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    // super_admin always has access
    if (req.user.role === "super_admin") {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(" or ")}.`,
      });
    }

    next();
  };
};

// Backward-compat alias
const requireRole = authorizeRole;

/**
 * Middleware factory: authorizePermission — Generic permission check.
 * Takes a function that receives (req) and returns true/false.
 * Usage: authorizePermission((req) => req.user.role === "admin" && someCondition)
 */
const authorizePermission = (checkFn) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    // super_admin bypasses permission checks
    if (req.user.role === "super_admin") {
      return next();
    }

    try {
      const allowed = await checkFn(req);
      if (!allowed) {
        return res.status(403).json({
          message: "Access denied. You do not have permission for this action.",
        });
      }
      next();
    } catch (error) {
      return res.status(500).json({ message: "Permission check failed." });
    }
  };
};

/**
 * Middleware factory: Block specific roles from accessing a route.
 * Usage: denyRole("auditor") — allows everyone except auditors
 */
const denyRole = (...blockedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (blockedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. ${req.user.role} role cannot perform this action.`,
      });
    }

    next();
  };
};

/**
 * Middleware factory: Require user's role to be at or above a minimum rank.
 * Usage: requireMinRole("manager") — allows manager, admin, super_admin
 */
const requireMinRole = (minRole) => {
  const minRank = ROLE_HIERARCHY[minRole];
  if (minRank === undefined) {
    throw new Error(`Unknown role: ${minRole}`);
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const userRank = ROLE_HIERARCHY[req.user.role] || 0;

    if (userRank < minRank) {
      return res.status(403).json({
        message: `Access denied. Minimum required role: ${minRole}.`,
      });
    }

    next();
  };
};

/**
 * Helper: Get client IP address from request
 */
const getClientIP = (req) => {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown";
};

module.exports = {
  authenticateUser,
  verifyToken,
  authorizeRole,
  authorizePermission,
  requireRole,
  denyRole,
  requireMinRole,
  getClientIP,
  ROLE_HIERARCHY,
  ALL_ROLES,
};
