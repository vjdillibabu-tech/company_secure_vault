const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { User, Team, Credential, AuditLog } = require("../models");

const router = express.Router();

// All dashboard routes require authentication
router.use(verifyToken);

// ──────────────────────────────────────────────
// GET /api/dashboard/stats — Aggregated security overview
// Available to all authenticated users; scoped by role
// ──────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const { role, userId } = req.user;
    const isAdmin = role === "super_admin" || role === "admin";

    // ── 1. User stats (admin only sees counts) ──
    let totalUsers = 0;
    let totalTeams = 0;

    if (isAdmin) {
      totalUsers = await User.countDocuments();
      totalTeams = await Team.countDocuments();
    }

    // ── 2. Credential stats (role-scoped) ──
    let credFilter = {};
    if (role === "super_admin") {
      // Sees everything
      credFilter = {};
    } else if (role === "admin") {
      // Sees all except super_admin restricted
      credFilter = {
        $or: [
          { addedBy: userId },
          { addedByRole: { $in: ["admin", "manager", "developer", "employee"] } },
        ],
      };
    } else {
      // Manager, developer, employee — own + team credentials
      const user = await User.findById(userId);
      if (user?.teamId) {
        credFilter = {
          $or: [
            { addedBy: userId },
            { teamId: user.teamId },
          ],
        };
      } else {
        credFilter = { addedBy: userId };
      }
    }

    const allCredentials = await Credential.find(credFilter).lean();
    const totalCredentials = allCredentials.length;

    // Health breakdown
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    let breached = 0;
    let weak = 0;
    let expiring = 0;
    let healthy = 0;

    for (const cred of allCredentials) {
      if (cred.compromised) {
        breached++;
      } else if (cred.passwordStrength !== undefined && cred.passwordStrength <= 1) {
        weak++;
      } else if (cred.lastRotated) {
        // Expiring: last rotated > 90 days ago
        if (new Date(cred.lastRotated) < ninetyDaysAgo) {
          expiring++;
        } else {
          healthy++;
        }
      } else {
        // No lastRotated: check updatedAt
        if (new Date(cred.updatedAt) < ninetyDaysAgo) {
          expiring++;
        } else {
          healthy++;
        }
      }
    }

    // ── 3. Alerts: breached + weak ──
    const alerts = breached + weak;

    // ── 4. Recent activity (last 10 entries) ──
    let activityFilter = {};
    if (!isAdmin) {
      activityFilter.userId = userId;
    }

    const recentActivity = await AuditLog.find(activityFilter)
      .populate("userId", "name email role")
      .populate("credentialId", "siteName")
      .populate("targetUserId", "name email")
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    // Format activity for frontend
    const formattedActivity = recentActivity.map((log) => {
      const userName = log.userId?.name || "Unknown";
      let description = "";
      let icon = "info"; // info, shield, key, user, alert, team

      switch (log.action) {
        case "CREATE_CREDENTIAL":
          description = `${userName} added ${log.credentialId?.siteName || "a credential"}`;
          icon = "key";
          break;
        case "VIEW_CREDENTIAL":
          description = `${userName} viewed ${log.credentialId?.siteName || "a credential"}`;
          icon = "eye";
          break;
        case "UPDATE_CREDENTIAL":
          description = `${userName} updated ${log.credentialId?.siteName || "a credential"}`;
          icon = "key";
          break;
        case "DELETE_CREDENTIAL":
          description = `${userName} deleted a credential`;
          icon = "alert";
          break;
        case "LOGIN":
          description = `${userName} signed in`;
          icon = "user";
          break;
        case "REGISTER":
          description = `${userName} created an account`;
          icon = "user";
          break;
        case "CREATE_TEAM":
          description = `${userName} created a new team`;
          icon = "team";
          break;
        case "ADD_MEMBER":
          description = `${userName} added a member to a team`;
          icon = "team";
          break;
        case "REMOVE_MEMBER":
          description = `${userName} removed a member from a team`;
          icon = "team";
          break;
        case "ROLE_CHANGE":
          description = `${userName} changed ${log.targetUserId?.name || "a user"}'s role`;
          icon = "shield";
          break;
        case "PASSWORD_CHANGE":
          description = `${userName} changed their password`;
          icon = "shield";
          break;
        case "PROFILE_UPDATE":
          description = `${userName} updated their profile`;
          icon = "user";
          break;
        case "LOGOUT":
          description = `${userName} signed out`;
          icon = "user";
          break;
        case "UNAUTHORIZED_ATTEMPT":
          description = `${userName} attempted unauthorized access`;
          icon = "alert";
          break;
        case "ACCESS_REQUESTED":
          description = `${userName} requested access to a resource`;
          icon = "shield";
          break;
        case "ACCESS_APPROVED":
          description = `${userName} approved an access request`;
          icon = "shield";
          break;
        case "ACCESS_REJECTED":
          description = `${userName} rejected an access request`;
          icon = "alert";
          break;
        default:
          description = `${userName} performed ${log.action.replace(/_/g, " ").toLowerCase()}`;
          icon = "info";
      }

      return {
        _id: log._id,
        action: log.action,
        description,
        icon,
        timestamp: log.timestamp,
        user: log.userId,
      };
    });

    // ── 5. Credential age distribution (for chart) ──
    let last7Days = 0;
    let last30Days = 0;
    let older = 0;
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const cred of allCredentials) {
      const created = new Date(cred.createdAt);
      if (created > sevenDaysAgo) last7Days++;
      else if (created > thirtyDaysAgo) last30Days++;
      else older++;
    }

    res.status(200).json({
      overview: {
        users: totalUsers,
        secrets: totalCredentials,
        teams: totalTeams,
        alerts,
      },
      health: {
        healthy,
        expiring,
        weak,
        breached,
        total: totalCredentials,
      },
      recentActivity: formattedActivity,
      credentialAge: {
        last7Days,
        last30Days,
        older,
      },
      isAdmin,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: "Server error while fetching dashboard stats." });
  }
});

module.exports = router;
