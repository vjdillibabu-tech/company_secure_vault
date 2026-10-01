const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { AuditLog, User } = require("../models");

const router = express.Router();

// All audit log routes require authentication + specific roles
router.use(verifyToken);
router.use(requireRole("super_admin", "admin"));

// ──────────────────────────────────────────────
// GET /api/audit-logs — List audit logs
// super_admin / admin / auditor (read-only)
// Supports query params: userId, action, startDate, endDate, page, limit
// ──────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const {
      userId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    // Filter by user
    if (userId) {
      filter.userId = userId;
    }

    // Filter by action type
    if (action) {
      filter.action = action;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await AuditLog.countDocuments(filter);

    const logs = await AuditLog.find(filter)
      .populate("userId", "name email role")
      .populate("credentialId", "credentialName siteName username")
      .populate("targetUserId", "name email role")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    res.status(500).json({ message: "Server error while fetching audit logs." });
  }
});

// ──────────────────────────────────────────────
// GET /api/audit-logs/users — List all users for filter dropdown
// ──────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "name email role").sort({ name: 1 });
    res.status(200).json({ users });
  } catch (error) {
    console.error("Fetch users for audit error:", error);
    res.status(500).json({ message: "Server error while fetching users." });
  }
});

module.exports = router;
