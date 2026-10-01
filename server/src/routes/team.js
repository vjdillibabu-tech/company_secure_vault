const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { Team, User, AuditLog } = require("../models");

const router = express.Router();

// All team routes require authentication
router.use(verifyToken);

// ──────────────────────────────────────────────
// POST /api/teams — Create a team (super_admin, admin)
// ──────────────────────────────────────────────
router.post("/", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Team name is required." });
    }

    const team = await Team.create({
      name,
      adminId: req.user.userId,
      members: [],
    });

    await AuditLog.create({
      userId: req.user.userId,
      action: "CREATE_TEAM",
    });

    res.status(201).json({
      message: "Team created successfully.",
      team,
    });
  } catch (error) {
    console.error("Create team error:", error);
    res.status(500).json({ message: "Server error while creating team." });
  }
});

// ──────────────────────────────────────────────
// GET /api/teams — List teams
// super_admin / admin: all teams
// manager: own team only
// employee / auditor: denied
// ──────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { role, userId } = req.user;

    // super_admin and admin see all teams
    if (role === "super_admin" || role === "admin") {
      const teams = await Team.find()
        .populate("adminId", "name email")
        .populate("members", "name email role");
      return res.status(200).json({ teams });
    }

    // manager sees only their own team
    if (role === "manager") {
      const user = await User.findById(userId);
      if (!user.teamId) {
        return res.status(200).json({ teams: [] });
      }
      const team = await Team.findById(user.teamId)
        .populate("adminId", "name email")
        .populate("members", "name email role");
      return res.status(200).json({ teams: team ? [team] : [] });
    }

    // employee and auditor cannot list teams
    return res.status(403).json({ message: "Access denied. Insufficient role." });
  } catch (error) {
    console.error("List teams error:", error);
    res.status(500).json({ message: "Server error while fetching teams." });
  }
});

// ──────────────────────────────────────────────
// GET /api/teams/unassigned-users — List users not in any team
// super_admin / admin only
// ──────────────────────────────────────────────
router.get("/unassigned-users", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const users = await User.find({ teamId: null }, "name email role").sort({ name: 1 });
    res.status(200).json({ users });
  } catch (error) {
    console.error("List unassigned users error:", error);
    res.status(500).json({ message: "Server error while fetching unassigned users." });
  }
});

// ──────────────────────────────────────────────
// POST /api/teams/:teamId/members — Assign user to team (super_admin, admin)
// ──────────────────────────────────────────────
router.post("/:teamId/members", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required." });
    }

    // Verify team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found." });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if user is already in this team
    if (team.members.includes(userId)) {
      return res.status(409).json({ message: "User is already a member of this team." });
    }

    // Add to team members array
    team.members.push(userId);
    await team.save();

    // Update the user's teamId
    user.teamId = teamId;
    await user.save();

    await AuditLog.create({
      userId: req.user.userId,
      action: "ADD_MEMBER",
    });

    res.status(200).json({
      message: `${user.name} added to ${team.name}.`,
      team: await Team.findById(teamId)
        .populate("adminId", "name email")
        .populate("members", "name email role"),
    });
  } catch (error) {
    console.error("Add member error:", error);
    res.status(500).json({ message: "Server error while adding member." });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/teams/:teamId/members/:userId — Remove member (super_admin, admin)
// ──────────────────────────────────────────────
router.delete("/:teamId/members/:userId", requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const { teamId, userId } = req.params;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Remove from team
    team.members = team.members.filter((id) => id.toString() !== userId);
    await team.save();

    // Clear user's teamId
    user.teamId = null;
    await user.save();

    await AuditLog.create({
      userId: req.user.userId,
      action: "REMOVE_MEMBER",
    });

    res.status(200).json({
      message: `${user.name} removed from ${team.name}.`,
    });
  } catch (error) {
    console.error("Remove member error:", error);
    res.status(500).json({ message: "Server error while removing member." });
  }
});

module.exports = router;
